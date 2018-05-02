import * as React from 'react';
import { Component, SFC } from 'react';
import {
  MatchLog,
  GameState,
  Player,
  PwTypes,
} from '../../lib/match';

import * as classNames from 'classnames';
import { PlayerMap, PlayerTurn } from '../../lib/match/MatchLog';

// tslint:disable-next-line:no-var-requires
const styles = require("./LogView.scss");

interface LogViewProps {
  matchLog: MatchLog;
}

interface PlayerLogs {
  players: Player[];
  turns: PlayerMap<PlayerTurn>[];
}

function makePlayerLogs(log: MatchLog): PlayerLogs {
  const players = log.players.filter((p) => p.number !== undefined);
  const turns = log.gameStates.map((state, idx) => {
    const playerTurns: PlayerMap<PlayerTurn> = {};
    players.forEach((player) => {
      const playerTurn = log.playerLogs[player.number].turns[idx];
      playerTurns[player.number] = playerTurn;
    });
    return playerTurns;
  });

  return { players, turns };
}

export class LogView extends Component<LogViewProps> {
  public render() {
    // TODO: do this transform higher up
    const playerLogs = makePlayerLogs(this.props.matchLog);

    const entries = this.props.matchLog.gameStates.map((state, idx) => {
      const players = playerLogs.players;
      const turns = playerLogs.turns[idx];
      return (
        <li className={classNames(styles.turn)} key={idx}>
          <TurnNumView turn={idx} />
          <TurnView players={players} turns={turns} />
        </li>
      );
    });

    return (
      <div className={styles.logRootNode}>
        <ul className={styles.turns}>
          {entries}
        </ul>
      </div>);
  }
}

export default LogView;

interface TurnProps {
  players: Player[];
  turns: PlayerMap<PlayerTurn>;
}

export const TurnView: SFC<TurnProps> = (props) => {
  // The last turn has no outputs for the players
  if (Object.keys(props.turns).length === 0) {
    return <GameEnd />;
  }
  const players = props.players.map((player, idx) => {
    const playerTurn = props.turns[player.number];
    return <PlayerView key={idx} player={player} turn={playerTurn} />;
  });

  return (
    <ul className={styles.turnOutput}>
      {players}
    </ul>);
};

interface PlayerViewProps { player: Player; turn: PlayerTurn; }
export const PlayerView: SFC<PlayerViewProps> = ({ player, turn }) => {
  const isError = { [styles.error]: turn.action!.type !== 'commands' };
  return (
    <li className={classNames(styles.player, isError)} key={player.uuid}>
      <div>
        <p className={styles.playerName}>{player.name}</p>
      </div>
      <PlayerTurnView turn={turn} />
    </li>
  );
};

export const PlayerTurnView: SFC<{ turn: PlayerTurn }> = ({ turn }) => {
  const action = turn.action!;
  switch (action.type) {
    case 'timeout' || 'parse_error': {
      return <Timeout/>;
    }
    case 'parse_error': {
      return <ParseErrorView command={turn.command} error={action.value} />;
    }
    case 'commands': {
      return <CommandsView commands={action.value}/>;
    }
  }
};

export const Timeout: SFC = () => {
  return (
    <div className={styles.playerOutput}>
      <span className={styles.error}> [TIMEOUT] </span>
    </div>
  );
};

export interface ParseErrorViewProps { command?: string; error: string; }
export const ParseErrorView: SFC<ParseErrorViewProps> = (props) => {
  return (
    <div className={styles.playerOutput}>
      <p>
        <span className={styles.error}> [ERROR] </span> {props.error}
      </p>
      <p>
        [OUTPUT] {props.command}
      </p>
    </div>
  );
};

export interface CommandsViewProps { commands: PwTypes.PlayerCommand[]; }
export const CommandsView: SFC<CommandsViewProps> = (props) => {
  const dispatches = props.commands.map((cmd, idx) => {
    const isWarning = { [styles.warning]: !!cmd.error };
    return (
      <li className={classNames(styles.playerOutput, isWarning)} key={idx}>
        <DispatchError error={cmd.error}/>
        <DispatchView cmd={cmd.command} />
      </li>
    );
  });
  return (
    <ul>{dispatches}</ul>
  );
};

export const DispatchError: SFC<{ error?: string }> = ({ error }) => {
  if (error) {
    return (
      <p>
        <span className={styles.warning}> [WARNING] </span> {error}
      </p>
    );
  } else {
    return null;
  }
};

export const DispatchView: SFC<{ cmd: PwTypes.Command }> = ({ cmd }) => {
  const { ship_count, origin, destination } = cmd;
  return (
    <div className={styles.dispatch}>
      <p>
        <FaIcon icon='globe' /> {origin}
      </p>
      <p>
        <FaIcon icon='globe' /> {destination}
      </p>
      <p>
        <FaIcon icon='rocket' /> {ship_count}
      </p>
    </div>
  );
};

export const FaIcon: SFC<{ icon: string }> = ({ icon }) =>
  <i className={classNames('fa', 'fa-' + icon)} aria-hidden={true} />;

export const TurnNumView: SFC<{ turn: number }> = ({ turn }) => {
  return (
    <div className={styles.turnNumber}>
      <p>
        {turn}
      </p>
    </div>
  );
};

export const GameEnd: SFC = () => {
  return (
    <div className={styles.gameEnd}>
      <p> Game end. </p>
    </div>
  );
};
