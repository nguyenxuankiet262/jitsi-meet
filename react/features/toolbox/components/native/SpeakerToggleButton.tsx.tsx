import { connect } from "react-redux";

import { translate } from "../../../base/i18n/functions";
import AbstractSpeakerButton, { IProps, mapStateToProps } from "../AbstractSpeakerButton";

export default translate(connect(mapStateToProps)(AbstractSpeakerButton<IProps>));
