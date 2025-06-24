import React, { ReactNode, useEffect, useRef } from "react";
import { Animated, Dimensions, PanResponder, StyleSheet } from "react-native";
import { SMALL_THUMBNAIL_SIZE } from "../../../filmstrip/constants";

interface Props {
    children: ReactNode;
    onClick?: () => void;
}

const DraggableParticipantView = React.memo(({ children, onClick }: Props) => {
    const pan = useRef(new Animated.ValueXY()).current;
    const gestureStartTime = useRef<number>(0);
    const isDragging = useRef(false);

    const lastOffset = useRef({ x: 0, y: 0 });

    const screen = Dimensions.get("window");
    const thumbnailWidth = SMALL_THUMBNAIL_SIZE;
    const thumbnailHeight = (SMALL_THUMBNAIL_SIZE * 4) / 3;
    const marginLeft = 8;
    const marginRight = 24;
    const marginTop = 0;
    const marginBottom = 200;

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

    useEffect(() => {
        console.log("DraggableParticipantView mounted");
        const initialX = screen.width - thumbnailWidth - marginRight;
        const initialY = marginTop;
        lastOffset.current = { x: initialX, y: initialY };
        pan.setOffset(lastOffset.current);
        pan.setValue({ x: 0, y: 0 });
    }, []);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,

            onPanResponderGrant: () => {
                gestureStartTime.current = Date.now();
                isDragging.current = false;
                pan.setOffset({ ...lastOffset.current });
                pan.setValue({ x: 0, y: 0 });
            },

            onPanResponderMove: (_, gestureState) => {
                if (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2) {
                    isDragging.current = true;
                    pan.setValue({ x: gestureState.dx, y: gestureState.dy });
                }
            },

            onPanResponderRelease: (_, gestureState) => {
                if (!isDragging.current && Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
                    onClick?.();
                }

                const newX = lastOffset.current.x + gestureState.dx;
                const newY = lastOffset.current.y + gestureState.dy;

                const maxX = screen.width - thumbnailWidth - marginRight;
                const maxY = screen.height - thumbnailHeight - marginBottom;

                const clampedX = clamp(newX, marginLeft, maxX);
                const clampedY = clamp(newY, marginTop, maxY);

                lastOffset.current = { x: clampedX, y: clampedY };
                pan.setOffset(lastOffset.current);
                pan.setValue({ x: 0, y: 0 });

                isDragging.current = false;
            },
        })
    ).current;

    return (
        <Animated.View
            {...panResponder.panHandlers}
            style={[styles.draggable, { transform: pan.getTranslateTransform() }]}
        >
            {children}
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    draggable: {
        zIndex: 100,
    },
});

export default DraggableParticipantView;
