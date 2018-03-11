import { routerReducer as routing, RouterState } from 'react-router-redux';
import { combineReducers, Reducer } from 'redux';

import * as A from '../actions/actions';
import { IBotConfig } from '../utils/ConfigModels';
import { IMatchMetaData } from '../utils/GameModels';

// Global state
export interface IGState {
  readonly routing: RouterState;
  readonly navbar: INavbarState;
  readonly botsPage: IBotsPageState;
  readonly matchesPage: IMatchesPageState;
  readonly aboutPage: IAboutPageState;
}

export interface INavbarState { readonly toggled: boolean; }
export interface IBotsPageState { readonly bots: IBotConfig[]; }
export interface IMatchesPageState {
  readonly matches: IMatchMetaData[];
  readonly importError?: string;
}
export interface IAboutPageState { readonly counter: number; }

export const initialState: IGState = {
  routing: { location: null },
  navbar: { toggled: false },
  botsPage: { bots: [] },
  matchesPage: { matches: [] },
  aboutPage: { counter: 0 },
};

const navbarReducer = combineReducers<INavbarState>({
  toggled: (state = false, action) => {
    if (A.toggleNavMenu.test(action)) {
      return !state;
    }
    return state;
  },
});

const aboutPageReducer = combineReducers<IAboutPageState>({
  counter: (state = 0, action) => {
    if (A.incrementAbout.test(action)) {
      return state + 1;
    }
    return state;
  },
});

const botsPageReducer = combineReducers<IBotsPageState>({
  bots: (state = [], action) => {
    if (A.addBot.test(action)) {
      const newA = state.slice();
      newA.push(action.payload);
      return newA;
    }
    return state;
  },
});

const matchesPageReducer = combineReducers<IMatchesPageState>({
  matches: (state = [], action) => {
    if (A.addMatchMeta.test(action)) {
      const newA = state.slice();
      newA.push(action.payload);
      return newA;
    }
    if (A.importMatchMeta.test(action)) {
      const newA = state.slice();
      newA.push(action.payload);
      return newA;
    }
    return state;
  },
  importError: (state = "", action) => {
    if (A.matchImportError.test(action)) {
      return action.payload;
    }
    return state;
  }
});

export const rootReducer = combineReducers<IGState>({
  routing: routing as Reducer<any>,
  navbar: navbarReducer,
  botsPage: botsPageReducer,
  matchesPage: matchesPageReducer,
  aboutPage: aboutPageReducer,
});
