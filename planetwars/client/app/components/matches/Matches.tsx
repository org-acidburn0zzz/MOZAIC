import * as React from 'react';
import { Component, SFC } from 'react';
import * as moment from 'moment';
import * as classnames from 'classnames';

import * as M from '../../database/models';
import * as Comp from './types';
import MatchView from './MatchView';
import { FatalErrorView } from '../FatalError';
import { MatchType } from '../../database/models';

import * as css from './Matches.scss';

export type MatchViewerProps = MatchViewerStateProps & MatchViewerDispatchProps;

export interface MatchViewerStateProps {
  selectedMatch?: M.MatchId;
  matches: Comp.Match[];
}

export interface MatchViewerDispatchProps {
  selectMatch: (matchId: string) => void;
}

export interface MatchViewerState {
  fatalError?: Error;
}

export default class MatchViewer extends Component<MatchViewerProps, MatchViewerState> {
  constructor(props: MatchViewerProps) {
    super(props);
    this.state = {};
  }

  public componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ fatalError: error });
  }

  public render() {
    console.log('RENDERING MATCHES PAGE');
    const { fatalError } = this.state;
    const { matches } = this.props;
    const selectedId = this.props.selectedMatch;

    if (fatalError) { return this.renderError(fatalError); }
    if (matches.length === 0) { return <NoMatches />; }

    return (
      <div className={css.matchViewer}>
        <MatchList
          matches={matches}
          selected={selectedId}
          selectMatch={this.props.selectMatch}
        />
        <MatchView matchId={selectedId} />
      </div>);
  }

  private renderError(error: Error) {
    return (
      <FatalErrorView
        error={error}
        message='The Matchviewer crashed!'
      />);
  }
}

interface MatchListProps {
  matches: Comp.Match[];
  selected?: M.MatchId;
  selectMatch: (matchId: string) => void;
}

export const MatchList: SFC<MatchListProps> = (props) => {
  const listEntries = props.matches.map((match) => {
    const onClick = () => props.selectMatch(match.uuid);
    return (
      <li key={match.uuid}>
        <MatchListEntry
          key={match.uuid}
          match={match}
          selected={props.selected === match.uuid}
          onClick={onClick}
        />
      </li>);
  });

  return <ul className={css.matchList}> {listEntries} </ul>;
};

function calcPlayerData(match: Comp.Match): PlayerProps[] {
  if (match.status === M.MatchStatus.finished) {
    return match.players.map((player, idx) => ({
      name: player.name,
      number: player.number,
      isWinner: match.stats.winners.some((num) => num === idx + 1),
      score: match.stats.score[idx + 1],
    })).sort((a, b) => {
      // sort major on isWinner, minor on score
      if (a.isWinner && !b.isWinner) {
        return 0;
      }
      if (b.isWinner && !a.isWinner) {
        return 1;
      }
      return b.score - a.score;
    });
  } else {
    return match.players.map((player) => ({
      number: player.number,
      name: player.name,
      isWinner: false,
    }));
  }
}

interface MatchEntryProps {
  match: Comp.Match;
  selected?: boolean;
  onClick: () => void;
}

export const MatchListEntry: SFC<MatchEntryProps> = (props) => {
  let className = css.matchListEntry;
  const { selected, match } = props;
  if (selected) {
    className = classnames(css.selected, className);
  }

  const playerData = calcPlayerData(match);
  return (
    <div className={className} onClick={props.onClick}>
      <div className={css.matchListEntryContent}>
        <PlayerList players={playerData} />
        <TimeLocation match={match} />
        <MatchStatus match={match} />
      </div>
    </div>
  );
};

export const FaIcon: SFC<{ icon: string }> = ({ icon }) =>
  <i className={classnames('fa', 'fa-' + icon)} aria-hidden={true} />;

interface PlayerProps {
  name: string;
  number: number;
  isWinner: boolean;
  score?: number;
}

export const PlayerList: SFC<{ players: PlayerProps[] }> = ({ players }) => {
  const entries = players.map((player) => (
    <PlayerEntry key={player.number} player={player} />
  ));
  return <ul className={css.playerList}> {entries} </ul>;
};

export const PlayerEntry: SFC<{ player: PlayerProps }> = ({ player }) => {
  let icon = null;
  if (player.isWinner) {
    icon = <FaIcon icon='trophy' />;
  }
  return (
    <li className={css.playerEntry}>
      <div className={css.iconSpan}> {icon} </div>
      <div className={css.playerName}> {player.name} </div>
      <PlayerScore player={player} />
    </li>
  );
};

export const PlayerScore: SFC<{ player: PlayerProps }> = ({ player }) => {
  if (!player.score) {
    return null;
  }
  return (
    <div className={css.playerScore} title='score'>
      <FaIcon icon='rocket' />
      {player.score}
    </div>
  );
};

function dateOrHour(date: Date) {
  const time = moment(date);
  if (moment().startOf('day') < time) {
    return time.format("HH:mm");
  } else {
    return time.format("DD/MM");
  }
}

export const TimeLocation: SFC<{ match: Comp.Match }> = ({ match }) => {
  let location = null;
  if (match.type === MatchType.hosted) {
    location = <MapField mapName={match.map.name} />;
  }

  const time = (
    <div className={css.matchTime} title='date'>
      {dateOrHour(match.timestamp)}
    </div>
  );

  return (
    <div className={css.timeLocation}>
      {location}
      {time}
    </div>
  );
};

export const MapField: SFC<{ mapName: string }> = ({ mapName }) => (
  <div className={css.mapName} title='map'>
    <div className={css.iconSpan}>
      <FaIcon icon='globe' />
    </div>

    {mapName}
  </div>
);

export const MatchStatus: SFC<{ match: Comp.Match }> = ({ match }) => {
  switch (match.status) {
    case M.MatchStatus.finished: {
      return null;
    }
    case M.MatchStatus.playing: {
      return (
        <div>
          <div className={css.iconSpan}>
            <FaIcon icon='play' />
          </div>
          in progress
        </div>);
    }
    case M.MatchStatus.error: {
      return (
        <div>
          <div className={css.iconSpan}>
            <FaIcon icon='exclamation-triangle' />
          </div>
          failed
        </div>);
    }
  }
};

export const NoMatches: React.SFC<{}> = (props) => {
  return (
    <div className={css.noMatches}>
      <p>
        No matches played yet!
      </p>
    </div>);
};
