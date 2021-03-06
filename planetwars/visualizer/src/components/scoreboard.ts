import Game from "./game";
import { Component } from "react";
import { GameState } from 'planetwars-match-log';

import * as h from 'react-hyperscript';
import * as hh from 'hyperscript-helpers';
const { table, tbody, tr, td } = (hh as any)(h);

import * as styles from './scoreboard.scss';

interface ScoreboardProps {
  game: Game;
  turnNum: number;
  playerName: (playerNum: number) => string;
}

function countPlanets(players: number[], state: GameState) {
  const counts: { [playerNum: number]: number } = {};

  players.forEach((playerNum) => {
    counts[playerNum] = 0;
  });

  Object.keys(state.planets).forEach((planetName) => {
    const planet = state.planets[planetName];
    if (planet.owner) {
      counts[planet.owner] += 1;
    }
  });
  return counts;
}

function countShips(players: number[], state: GameState) {
  const counts: { [playerNum: number]: number } = {};

  players.forEach((playerNum) => {
    counts[playerNum] = 0;
  });

  Object.keys(state.planets).forEach((planetName) => {
    const planet = state.planets[planetName];
    if (planet.owner) {
      counts[planet.owner] += planet.shipCount;
    }
  });
  state.expeditions.forEach((expedition) => {
    counts[expedition.owner] += expedition.shipCount;
  });
  return counts;
}

export default class Scoreboard extends Component<ScoreboardProps> {
  private svg: any;

  public render() {
    const { game, turnNum, playerName } = this.props;
    const gameState = game.matchLog.gameStates[turnNum];
    const players = Array.from(game.matchLog.getPlayers());
    const planetCounts = countPlanets(players, gameState);
    const shipCounts = countShips(players, gameState);

    const rows = players.map((playerNum) => {
      const planetCount = planetCounts[playerNum];
      return tr({ style: { color: game.playerColor(playerNum) } }, [
        h('i.fa.fa-cogs', {
          'aria-hidden': true,
        }),
        td(playerName(playerNum)),
        td(planetCount),
        h('i.fa.fa-globe', {
          'aria-hidden': true,
        }),
        td(shipCounts[playerNum]),
        h('i.fa.fa-rocket', {
          'aria-hidden': true,
        }),
      ]);
    });
    return table(`.${styles.scoreboard}`, {}, tbody(rows));
  }
}
