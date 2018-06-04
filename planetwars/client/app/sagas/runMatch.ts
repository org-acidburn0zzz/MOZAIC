
import { eventChannel, Channel } from 'redux-saga';
import * as A from '../actions';
import { Address, PlayerData, ClientData, PwConfig, LobbyState } from '../reducers/lobby';
import { MatchRunner, MatchControl, Logger, Client, PwClient } from 'mozaic-client';
import { Config } from '../utils/Config';
import { generateToken } from '../utils/GameRunner';
import { ServerParams, BotParams } from '../actions/lobby';
import { ActionWithPayload } from '../actions/helpers';
import { ISimpleEvent } from 'ste-simple-events';
import * as M from '../database/models';
import { GState } from '../reducers';
import { parseLogFile, calcStats } from '../lib/match';

import {
  call,
  apply,
  take,
  takeEvery,
  put,
  fork,
  select,
  cancel,
  race,
  spawn,
} from 'redux-saga/effects';

// tslint:disable-next-line:no-var-requires
const stringArgv = require('string-argv');

export function* runMatchSaga() {
  while (true) {
    const { payload: serverParams} = yield take(A.startServer.type);
    const runner: MatchRunner = yield call(startServer, serverParams);

    // start the lobby
    const lobbyTask = yield fork(runLobby, runner);

    // run lobby until either the server is being shutdown, or the match
    // is being started
    const { stop, run } = yield race({
      stop: take(A.stopServer.type),
      run: take(A.startMatch.type),
    });
    yield cancel(lobbyTask);

    if (stop) {
      runner.shutdown();
      yield put(A.serverStopped());
    }
    if (run) {
      const match = yield call(assembleMatch, serverParams.matchId, run.payload);
      yield spawn(runMatch, runner, match);
      yield put(A.resetLobby());
    }
  }
}

function* startServer(params: ServerParams) {
  const runner = yield call(MatchRunner.create, Config.matchRunner, {
    address: params.address,
    ctrl_token: generateToken(),
    logFile: Config.matchLogPath(params.matchId),
  });
  yield put(A.serverStarted(params.matchId));
  return runner;
}

function* runLobby(runner: MatchRunner) {
  yield fork(watchConnectEvents, runner.matchControl);
  yield fork(watchDisconnectEvents, runner.matchControl);
  yield fork(watchCreatePlayer, runner.matchControl);
  yield fork(watchRunLocalBot, runner.logger);
}

function* watchCreatePlayer(match: MatchControl) {
  yield takeEvery(A.createPlayer.type, registerPlayer, match);
}

function* watchConnectEvents(match: MatchControl) {
  const channel = simpleEventChannel(match.onPlayerConnected);
  yield takeEvery(channel, function*(clientId: number) {
    yield put(A.clientConnected({ clientId }));
  });
}

function* watchDisconnectEvents(match: MatchControl) {
  const channel = simpleEventChannel(match.onPlayerDisconnected);
  yield takeEvery(channel, function*(clientId: number) {
    yield put(A.clientDisconnected({ clientId }));
  });
}

function* watchRunLocalBot(logger: Logger) {
  function* runLocalBot(action: ActionWithPayload<BotParams>) {
    const { address, token, bot } = action.payload;
    const [command, ...args] = stringArgv(bot.command);
    const botConfig = { command, args };

    const client = yield call(Client.connect, {
      host: address.host,
      port: address.port,
      token: new Buffer(token, 'hex'),
      logger,
    });
    const pwClient = new PwClient(client, botConfig);
  }
  yield takeEvery(A.runLocalBot.type, runLocalBot);
}

function* registerPlayer(match: MatchControl, action: ActionWithPayload<PlayerData>) {
  const player = action.payload;
  const token = generateToken();

  const tokenBuf = Buffer.from(token, 'hex');
  const clientId = yield call([match, match.addPlayer], tokenBuf);

  yield put(A.clientRegistered({
    playerId: player.id,
    clientId,
    token,
  }));
}

function simpleEventChannel<T>(event: ISimpleEvent<T>): Channel<T> {
  return eventChannel((emit) => {
    event.subscribe(emit);
    const unsubscribe = () => event.unsubscribe(emit);
    return unsubscribe;
  });
}

function matchEventChannel(runner: MatchRunner) {
  return eventChannel((emit) => {
    const completeHandler = () => emit('complete');
    const errorHandler = (err: Error) => emit(err);

    runner.onComplete.subscribe(completeHandler);
    runner.onError.subscribe(errorHandler);

    const unsubscribe = () => {
      runner.onComplete.unsubscribe(completeHandler);
      runner.onError.unsubscribe(errorHandler);
    };

    return unsubscribe;
  });
}

function* runMatch(runner: MatchRunner, match: M.PlayingHostedMatch) {
  const mapPath = yield select((state: GState) => state.maps[match.map].mapPath);
  const matchChan = matchEventChannel(runner);

  yield call([runner.matchControl, runner.matchControl.startGame], {
    map_file: mapPath,
    max_turns: match.maxTurns,
  });
  yield put(A.saveMatch(match));

  const event = yield take(matchChan);
  if (event === 'complete') {
    const log = parseLogFile(match.logPath, match.type);
    const updatedMatch: M.FinishedMatch = {
      ...match,
      stats: calcStats(log),
      status: M.MatchStatus.finished,
    };
    yield put(A.saveMatch(updatedMatch));
  } else {
    const updatedMatch: M.ErroredMatch = {
      ...match,
      status: M.MatchStatus.error,
      // TODO: include more information or something
      error: event.message,
    };
    yield put(A.saveMatch(updatedMatch));
  }
}

function* assembleMatch(matchId: string, conf: PwConfig) {
  const lobby: LobbyState = yield select((state: GState) => state.lobby);
  const players = Object.keys(lobby.players).map((playerId) => {
    const player = lobby.players[playerId];
    // just force client id for now
    const client = lobby.clients[player.clientId!];
    if (player.botId) {
      const slot: M.InternalBotSlot = {
        type: M.BotSlotType.internal,
        name: player.name,
        token: client.token,
        connected: client.connected,
        botId: player.botId,
      };
      return slot;
    } else {
      const slot: M.ExternalBotSlot = {
        type: M.BotSlotType.external,
        name: player.name,
        token: client.token,
        connected: client.connected,
      };
      return slot;
    }
  });

  const match: M.HostedMatch = {
    uuid: matchId,
    type: M.MatchType.hosted,
    status: M.MatchStatus.playing,
    maxTurns: conf.maxTurns,
    map: conf.mapId,
    timestamp: new Date(),
    logPath: Config.matchLogPath(matchId),
    network: lobby.address,
    players,
  };

  return match;
}