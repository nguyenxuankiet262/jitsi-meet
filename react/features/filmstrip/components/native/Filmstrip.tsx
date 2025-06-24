import React, { PureComponent } from "react";
import { FlatList, ViewStyle, ViewToken } from "react-native";
import { SafeAreaView, withSafeAreaInsets } from "react-native-safe-area-context";
import { connect } from "react-redux";

import { IReduxState, IStore } from "../../../app/types";
import { getLocalParticipant } from "../../../base/participants/functions";
import Platform from "../../../base/react/Platform.native";
import { ASPECT_RATIO_NARROW } from "../../../base/responsive-ui/constants";
import { getHideSelfView } from "../../../base/settings/functions.any";
import { isToolboxVisible } from "../../../toolbox/functions.native";
import { setVisibleRemoteParticipants } from "../../actions.native";
import {
    getFilmstripDimensions,
    isFilmstripVisible,
    shouldDisplayLocalThumbnailSeparately,
    shouldRemoteVideosBeVisible,
} from "../../functions.native";

import { pinParticipant } from "../../../base/participants/actions";
import DraggableParticipantView from "../../../base/participants/components/DraggableParticipantView";
import LocalThumbnail from "./LocalThumbnail";
import Thumbnail from "./Thumbnail";
import styles from "./styles";

// Immutable reference to avoid re-renders.
const NO_REMOTE_VIDEOS: any[] = [];

/**
 * Filmstrip component's property types.
 */
interface IProps {
    /**
     * Application's aspect ratio.
     */
    _aspectRatio: Symbol;

    _clientHeight: number;

    _clientWidth: number;

    /**
     * Whether or not to hide the self view.
     */
    _disableSelfView: boolean;

    _localParticipantId: string;

    _pinnedParticipantId: string | undefined;

    /**
     * The participants in the conference.
     */
    _participants: Array<any>;

    /**
     * Whether or not the toolbox is displayed.
     */
    _toolboxVisible: Boolean;

    /**
     * The indicator which determines whether the filmstrip is visible.
     */
    _visible: boolean;

    /**
     * Invoked to trigger state changes in Redux.
     */
    dispatch: IStore["dispatch"];

    /**
     * Object containing the safe area insets.
     */
    insets?: Object;
}

/**
 * Implements a React {@link Component} which represents the filmstrip on
 * mobile/React Native.
 *
 * @augments Component
 */
class Filmstrip extends PureComponent<IProps> {
    /**
     * Whether the local participant should be rendered separately from the
     * remote participants i.e. outside of their {@link ScrollView}.
     */
    _separateLocalThumbnail: boolean;

    /**
     * The FlatList's viewabilityConfig.
     */
    _viewabilityConfig: Object;

    /**
     * Constructor of the component.
     *
     * @inheritdoc
     */

    _flatListRef = React.createRef<FlatList<string>>();

    constructor(props: IProps) {
        super(props);

        // XXX Our current design is to have the local participant separate from
        // the remote participants. Unfortunately, Android's Video
        // implementation cannot accommodate that because remote participants'
        // videos appear on top of the local participant's video at times.
        // That's because Android's Video utilizes EGL and EGL gives us only two
        // practical layers in which we can place our participants' videos:
        // layer #0 sits behind the window, creates a hole in the window, and
        // there we render the LargeVideo; layer #1 is known as media overlay in
        // EGL terms, renders on top of layer #0, and, consequently, is for the
        // Filmstrip. With the separate LocalThumbnail, we should have left the
        // remote participants' Thumbnails in layer #1 and utilized layer #2 for
        // LocalThumbnail. Unfortunately, layer #2 is not practical (that's why
        // I said we had two practical layers only) because it renders on top of
        // everything which in our case means on top of participant-related
        // indicators such as moderator, audio and video muted, etc. For now we
        // do not have much of a choice but to continue rendering LocalThumbnail
        // as any other remote Thumbnail on Android.
        this._separateLocalThumbnail = shouldDisplayLocalThumbnailSeparately();

        this._viewabilityConfig = {
            itemVisiblePercentThreshold: 30,
            minimumViewTime: 500,
        };

        this._keyExtractor = this._keyExtractor.bind(this);
        this._getItemLayout = this._getItemLayout.bind(this);
        this._onViewableItemsChanged = this._onViewableItemsChanged.bind(this);
        this._renderThumbnail = this._renderThumbnail.bind(this);
    }

    override componentDidMount() {
        this._scrollToPinnedParticipant();
    }

    /**
     * Returns a key for a passed item of the list.
     *
     * @param {string} item - The user ID.
     * @returns {string} - The user ID.
     */
    _keyExtractor(item: string) {
        return item;
    }

    /**
     * Calculates the width and height of the filmstrip based on the screen size and aspect ratio.
     *
     * @returns {Object} - The width and the height.
     */
    _getDimensions() {
        const { _aspectRatio, _clientWidth, _clientHeight, _disableSelfView, _localParticipantId, insets } = this.props;
        const localParticipantVisible = Boolean(_localParticipantId) && !_disableSelfView;

        return getFilmstripDimensions({
            aspectRatio: _aspectRatio,
            clientHeight: _clientHeight,
            clientWidth: _clientWidth,
            insets,
            localParticipantVisible,
        });
    }

    /**
     * Optimization for FlatList. Returns the length, offset and index for an item.
     *
     * @param {Array<string>} _data - The data array with user IDs.
     * @param {number} index - The index number of the item.
     * @returns {Object}
     */
    _getItemLayout(_data: string[] | null | undefined, index: number) {
        const { _aspectRatio } = this.props;
        const isNarrowAspectRatio = _aspectRatio === ASPECT_RATIO_NARROW;
        const length = isNarrowAspectRatio ? styles.thumbnail.width : styles.thumbnail.height;

        return {
            length,
            offset: length * index,
            index,
        };
    }

    /**
     * A handler for visible items changes.
     *
     * @param {Object} data - The visible items data.
     * @param {Array<Object>} data.viewableItems - The visible items array.
     * @returns {void}
     */
    _onViewableItemsChanged({ viewableItems = [] }: { viewableItems: ViewToken[] }) {
        const { _disableSelfView } = this.props;

        if (!this._separateLocalThumbnail && !_disableSelfView && viewableItems[0]?.index === 0) {
            // Skip the local thumbnail.
            viewableItems.shift();
        }

        if (viewableItems.length === 0) {
            // User might be fast-scrolling, it will stabilize.
            return;
        }

        let startIndex = Number(viewableItems[0].index);
        let endIndex = Number(viewableItems[viewableItems.length - 1].index);

        if (!this._separateLocalThumbnail && !_disableSelfView) {
            // We are off by one in the remote participants array.
            startIndex -= 1;
            endIndex -= 1;
        }

        this.props.dispatch(setVisibleRemoteParticipants(startIndex, endIndex));
    }

    /**
     * Creates React Element to display each participant in a thumbnail.
     *
     * @private
     * @returns {ReactElement}
     */
    _renderThumbnail({ item }: { item: string }) {
        return <Thumbnail key={item} participantID={item} />;
    }

    _scrollToPinnedParticipant() {
        const { _participants, _pinnedParticipantId, _localParticipantId } = this.props;

        if (!_pinnedParticipantId) return;

        const isPinningSelf = _pinnedParticipantId === _localParticipantId;

        if (isPinningSelf) {
            if (this._flatListRef.current) {
                this._flatListRef.current.scrollToEnd({ animated: true });
            }
        } else {
            const index = _participants.indexOf(_pinnedParticipantId);

            if (index !== -1 && this._flatListRef.current) {
                this._flatListRef.current.scrollToIndex({ index, animated: true });
            }
        }
    }

    _onPin() {
        const { dispatch, _participants, _localParticipantId } = this.props;

        if (_participants.length === 0) {
            dispatch(pinParticipant(_localParticipantId));
        } else {
            dispatch(pinParticipant(_participants[0]));
        }
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
    override render() {
        const { _aspectRatio, _disableSelfView, _toolboxVisible, _localParticipantId, _participants, _visible } =
            this.props;

        if (!_visible) {
            return null;
        }

        const bottomEdge = Platform.OS === "ios" && !_toolboxVisible;
        const isNarrowAspectRatio = _aspectRatio === ASPECT_RATIO_NARROW;
        const filmstripStyle = isNarrowAspectRatio ? styles.filmstripNarrow : styles.filmstripWide;
        const { height, width } = this._getDimensions();
        // const { height: thumbnailHeight, width: thumbnailWidth, margin } = styles.thumbnail;
        const thumbnailHeight = 250;
        const thumbnailWidth = 100;
        const margin = 2;
        const initialNumToRender = Math.ceil(
            isNarrowAspectRatio ? width / (thumbnailWidth + 2 * margin) : height / (thumbnailHeight + 2 * margin)
        );
        let participants;

        if (this._separateLocalThumbnail || _disableSelfView) {
            participants = _participants;
        } else if (isNarrowAspectRatio) {
            if (_participants.length === 1) {
                participants = [..._participants];
            } else {
                participants = [..._participants, _localParticipantId];
            }
        } else {
            participants = [_localParticipantId, ..._participants];
        }

        console.log(`participants: ${participants[0]}`);

        // const isPinMe =

        return (
            <SafeAreaView // @ts-ignore
                edges={[bottomEdge && "bottom", "left", "right"].filter(Boolean)}
                style={[filmstripStyle as ViewStyle, { marginBottom: 90 + 16 }]}
            >
                {this._separateLocalThumbnail && !isNarrowAspectRatio && !_disableSelfView && <LocalThumbnail />}
                {participants.length === 1 ? (
                    <DraggableParticipantView key="draggable" onClick={() => this._onPin()}>
                        <Thumbnail key={participants[0]} participantID={participants[0]} disableOnClick={true} />
                    </DraggableParticipantView>
                ) : (
                    <FlatList
                        ref={this._flatListRef}
                        bounces={false}
                        data={participants}
                        /* @ts-ignore */
                        getItemLayout={this._getItemLayout}
                        horizontal={isNarrowAspectRatio}
                        initialNumToRender={initialNumToRender}
                        key={isNarrowAspectRatio ? "narrow" : "wide"}
                        keyExtractor={this._keyExtractor}
                        onViewableItemsChanged={this._onViewableItemsChanged}
                        renderItem={this._renderThumbnail}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={[styles.flatListStageView, { paddingHorizontal: 4 }]}
                        style={{ width: "100%" }}
                        viewabilityConfig={this._viewabilityConfig}
                        windowSize={2}
                        inverted
                    />
                )}
                {this._separateLocalThumbnail && isNarrowAspectRatio && !_disableSelfView && <LocalThumbnail />}
            </SafeAreaView>
        );
    }
}

/**
 * Maps (parts of) the redux state to the associated {@code Filmstrip}'s props.
 *
 * @param {Object} state - The redux state.
 * @private
 * @returns {IProps}
 */
function _mapStateToProps(state: IReduxState) {
    const { enabled, remoteParticipants } = state["features/filmstrip"];
    const disableSelfView = getHideSelfView(state);
    const showRemoteVideos = shouldRemoteVideosBeVisible(state);
    const responsiveUI = state["features/base/responsive-ui"];

    return {
        _aspectRatio: responsiveUI.aspectRatio,
        _clientHeight: responsiveUI.clientHeight,
        _clientWidth: responsiveUI.clientWidth,
        _disableSelfView: disableSelfView,
        _localParticipantId: getLocalParticipant(state)?.id ?? "",
        _participants: showRemoteVideos ? remoteParticipants : NO_REMOTE_VIDEOS,
        _toolboxVisible: isToolboxVisible(state),
        _visible: enabled && isFilmstripVisible(state),
        _pinnedParticipantId: state["features/base/participants"].pinnedParticipant,
    };
}

export default withSafeAreaInsets(connect(_mapStateToProps)(Filmstrip));
