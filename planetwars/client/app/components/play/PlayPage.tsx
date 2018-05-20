import * as React from 'react';
import { connect } from 'react-redux';

import * as M from '../../database/models';
import { GState } from '../../reducers';

import { Config, WeakConfig } from './Config';
import { Lobby } from './Lobby';
import { LocalBotSelector } from './LocalBotSelector';
import { ServerControls } from './ServerControls';

// tslint:disable-next-line:no-var-requires
const styles = require('./PlayPage.scss');

function mapStateToProps(state: GState): PlayPageStateProps {
  const { maps } = state;
  return { maps };
}

function mapDispatchToProps(dispatch: any): PlayPageDispatchProps {
  return {};
}

export interface PlayPageStateProps { maps: M.MapList; }
export interface PlayPageDispatchProps { }
export type PlayPageProps = PlayPageStateProps & PlayPageDispatchProps;

export interface PlayPageState {
  isServerRunning: boolean;
  config?: WeakConfig;
}

export class PlayPage extends React.Component<PlayPageProps, PlayPageState> {
  public state: PlayPageState = {
    isServerRunning: false,
  };

  public render() {
    const { maps } = this.props;
    return (
      <div className={styles.playPageContainer}>
        <div className={styles.playPage}>

          {/* Left side*/}
          <div className={styles.leftColumn}>
            <div className={styles.lobbyContainer}>
              <Lobby />
            </div>
          </div>

          {/* Right side*/}
          <div className={styles.rightColumn}>
            <div className={styles.configContainer}>
              <Config maps={maps} setConfig={this.setConfig} />
            </div>
            <div className={styles.localBotSelectorContainer}>
              <LocalBotSelector />
            </div>
          </div>
        </div>
      </div>
    );
  }

  private setConfig = (config: WeakConfig) => this.setState({ config });
}

export default connect<PlayPageStateProps, PlayPageDispatchProps>(
  mapStateToProps, mapDispatchToProps,
)(PlayPage);
