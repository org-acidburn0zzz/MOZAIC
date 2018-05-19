import { connect } from 'react-redux';

import * as M from "../../database/models";
import { GState } from '../../reducers/index';
import { addBot, removeBot, editBot } from '../../actions';

import { Bots, BotsStateProps, BotsDispatchProps, ConfigErrors } from "./Bots";

interface Props {
  match: any;
}

const mapStateToProps = (state: GState, ownProps: Props) => {
  const bots = state.bots;
  const uuid: M.BotId | undefined = ownProps.match.params.bot;
  if (uuid) {
    const selectedBot: M.Bot = bots[uuid];
    return { bots, selectedBot };
  }
  return { bots };
};

const mapDispatchToProps = (dispatch: any) => {
  return {
    addBot: (name: string, command: string) => {
      dispatch(addBot({ name, command }));
    },
    removeBot: (uuid: M.BotId) => {
      dispatch(removeBot(uuid));
    },
    editBot: (bot: M.Bot) => {
      dispatch(editBot(bot));
    },
    validate: (name: string, command: string) => {
      const errors: ConfigErrors = {};
      if (!name || name.length === 0) {
        errors.name = 'Name should not be empty';
      }

      if (!command || command.length === 0) {
        errors.command = 'Command should not be empty';
      }

      return errors;
    },
  };
};

export default connect<BotsStateProps, BotsDispatchProps>(mapStateToProps, mapDispatchToProps)(Bots);
