import { NativeModules } from "react-native";
import { IReduxState } from "../../app/types";
import { IProps as AbstractButtonProps } from "../../base/toolbox/components/AbstractButton";
import BaseSpeakerToggleButton from "../../base/toolbox/components/BaseSpeakerToggleButton";
import { setAudioModeSpeaker } from "../actions.any";

const { AudioMode } = NativeModules;

export interface IProps extends AbstractButtonProps {
    _isSpeakerOn: boolean;
}

export default class AbstractSpeakerButton<P extends IProps> extends BaseSpeakerToggleButton<P> {
    override accessibilityLabel = "toolbar.accessibilityLabel.speaker";
    override toggledAccessibilityLabel = "toolbar.accessibilityLabel.earpiece";
    override label = "toolbar.speaker";
    override toggledLabel = "toolbar.earpiece";
    override tooltip = "toolbar.speaker";
    override toggledTooltip = "toolbar.earpiece";

    override _isToggled() {
        return this.props._isSpeakerOn;
    }

    override _isAudioSpeaker() {
        return this.props._isSpeakerOn;
    }

    override async _setAudioSpeaker(audioSpeaker: boolean) {
        this.props.dispatch(setAudioModeSpeaker(audioSpeaker));
    }
}

export function mapStateToProps(state: IReduxState) {
    const { isSpeakerOn = true, devices = [] } = state["features/mobile/audio-mode"] ?? {};
    const hasMultipleDevices = devices.length >= 2;

    return {
        _isSpeakerOn: !hasMultipleDevices || isSpeakerOn,
    };
}
