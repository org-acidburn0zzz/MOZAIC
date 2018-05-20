import * as fs from 'mz/fs';
import * as p from 'path';
import * as Promise from 'bluebird';
import { connect, Dispatch } from 'react-redux';
import { push } from 'react-router-redux';
import { PathLike } from 'mz/fs';

import { GState } from '../../reducers/index';
import { Config } from '../../utils/Config';
import * as A from '../../actions';
import * as M from '../../database/models';

import * as Comp from './types';
import Matches, {
  MatchViewerStateProps,
  MatchViewerDispatchProps,
} from './Matches';

function mapStateToProps(state: GState, ownProps: any): MatchViewerStateProps {
  const matches = Object.keys(state.matches).map((matchId) => {
    return getMatchData(state, matchId);
  });

  // Sort descending on time
  matches.sort((a, b) => (b.timestamp.getTime() - a.timestamp.getTime()));

  const selectedId: string | undefined = ownProps.match.params.matchId;
  if (selectedId && state.matches[selectedId]) {
    const selectedMatch = getMatchData(state, selectedId);
    return { matches, selectedMatch };
  } else {
    return { matches };
  }
}

function mapDispatchToProps(dispatch: any): MatchViewerDispatchProps {
  return {
    selectMatch: (matchId: string) => {
      dispatch(push(`/matches/${matchId}`));
    },
  };
}

const getMatchData = (state: GState, matchId: M.MatchId): Comp.Match => {
  const matchData = state.matches[matchId];
  const log = state.logs[matchId];

  if (matchData.type === M.MatchType.hosted) {
    const players = matchData.players.map(({ name }, idx) => (
      { name, number: idx + 1 }
    ));
    const mapData = state.maps[matchData.map];
    const map = { uuid: mapData.uuid, name: mapData.name };
    const { network, maxTurns, ...props } = matchData;
    return {
      ...props,
      players,
      map,
      log,
    };
  } else {
    const { network, bot, ...props } = matchData;
    const players = [{
      name: bot.name,
      number: 1,
    }];
    return {
      ...props,
      players,
      log,
    };
  }
};

export default connect(mapStateToProps, mapDispatchToProps)(Matches);
