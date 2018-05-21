import * as React from 'react';

import Visualizer from '../visualizer/Visualizer';
import * as Comp from './types';
import { emptyLog, parseLogFile, MatchLog } from '../../lib/match';
import { LogView } from './LogView';
import * as M from '../../database/models';
import { Log } from '../../reducers/logs';
import { GState } from '../../reducers/index';
import { createSelector } from 'reselect';
import { connect } from 'react-redux';

// tslint:disable-next-line:no-var-requires
const styles = require('./Matches.scss');

export interface ContainerProps {
  matchId?: string;
}

const matchSelector = (state: GState, ownProps: ContainerProps) => {
  if (ownProps.matchId) {
    return state.matches[ownProps.matchId];
  } else {
    return undefined;
  }
};

const logSelector = (state: GState, ownProps: ContainerProps) => {
  if (ownProps.matchId) {
    return state.logs[ownProps.matchId];
  } else {
    return undefined;
  }
};

const matchViewSelector = createSelector(
  matchSelector,
  logSelector,
  (match, log): MatchViewProps => ({
    match,
    log,
  }),
);

export interface MatchViewProps {
  match?: M.Match;
  log?: Log;
}

export interface MatchViewState {
  error?: {
    error: any;
    info: any;
  };
}

export class MatchView extends React.Component<MatchViewProps, MatchViewState> {
  private matchLog?: MatchLog;
  // how many log records were already consumed
  private logPos = 0;

  public constructor(props: MatchViewProps) {
    super(props);
    this.state = {};
  }

  public componentWillReceiveProps(nextProps: MatchViewProps) {
    const currentMatch = this.props.match;
    const nextMatch = nextProps.match;

    if (!nextMatch) {
      this.matchLog = undefined;
      return;
    }

    const log = nextProps.log;
    if (log) {
      // a log is present in the redux store; use it

      if (!currentMatch || currentMatch.uuid !== nextMatch.uuid) {
        // match changed; initialize a new log
        this.matchLog = emptyLog(nextMatch.type);
        this.logPos = 0;
      }

      // add new entries
      log.slice(this.logPos).forEach((entry) => {
        this.matchLog!.addEntry(entry!);
      });
      this.logPos = log.size;
    } else {
      // no log is present in redux store; read from disk
      this.matchLog = parseLogFile(nextMatch.logPath, nextMatch.type);
    }
  }

  // Catch the visualizer throwing errors so your whole app isn't broken
  public componentDidCatch(error: any, info: any) {
    this.setState({ error: { error, info } });
  }

  public render() {
    if (this.state.error) {
      return (
        <div>
          <p>{this.state.error.error.toString()}</p>
          <p>{JSON.stringify(this.state.error.info)}</p>
        </div>
      );
    }
    const { match } = this.props;
    if (!match) {
      return null;
    }

    if (match.status === M.MatchStatus.error) {
      return (
        <div className={styles.matchViewContainer}>
          <div className={styles.matchError}>
            {match.error}
          </div>
        </div>
      );
    }

    const matchLog = this.matchLog;

    if (!matchLog || matchLog.gameStates.length === 0) {
      return (
        <div className={styles.matchViewContainer}>
          <div className={styles.matchInProgress}>
            match in progress
          </div>
        </div>
      );
    }

    // render the match log
    return (
      <div className={styles.matchViewContainer}>
        <MatchViewer match={match} matchLog={matchLog} />
      </div>
    );
  }
}

interface Props {
  match: M.Match;
  matchLog: MatchLog;
}

enum ViewState {
  VISUALIZER,
  LOG,
}

interface State {
  viewState: ViewState;
}

export class MatchViewer extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.playerName = this.playerName.bind(this);
    this.state = {
      viewState: ViewState.VISUALIZER,
    };
  }

  public render() {
    const { matchLog } = this.props;
    const { viewState } = this.state;

    const showVisualizer = () => {
      this.setState({ viewState: ViewState.VISUALIZER });
    };

    const showVis = () => this.showVisualizer();
    const showLog = () => this.showLog();

    return (
      <div className={styles.matchView}>
        <div className={styles.matchTitleBar}>
          <div onClick={showVis} className={styles.matchTitleBarElement}> Visualizer </div>
          <div onClick={showLog} className={styles.matchTitleBarElement}> Log </div>
        </div>
        <div className={styles.displayBox}>
          <MatchDisplay
            viewState={viewState}
            matchLog={matchLog}
            playerName={this.playerName()}
          />
        </div>
      </div>
    );
  }

  public playerName() {
    const { match } = this.props;
    const playerNames: { [playerNum: number]: string } = {};

    switch (match.type) {
      case M.MatchType.joined: {
        playerNames[1] = match.bot.name;
        break;
      }
      case M.MatchType.hosted: {
        match.players.forEach((player, idx) => {
          playerNames[idx + 1] = player.name; 
        });
      }
    }

    return (playerNum: number) => {
      if (playerNames[playerNum]) {
        return playerNames[playerNum];
      } else {
        return `Player ${playerNum}`;
      }
    };
  }

  private showVisualizer() {
    this.setState({ viewState: ViewState.VISUALIZER });
  }

  private showLog() {
    this.setState({ viewState: ViewState.LOG });
  }
}

interface MatchDisplayProps {
  viewState: ViewState;
  matchLog: MatchLog;
  playerName: (playerNum: number) => string;
}

const MatchDisplay: React.SFC<MatchDisplayProps> = (props) => {
  const { viewState, matchLog, playerName } = props;
  switch (viewState) {
    case ViewState.VISUALIZER:
      return <Visualizer playerName={playerName} matchLog={matchLog} />;
    case ViewState.LOG:
      return <LogView playerName={playerName} matchLog={matchLog} />;
  }
};

export default connect(matchViewSelector)(MatchView);
