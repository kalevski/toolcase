import InputFeature, {
    ACTION_PRESS,
    ACTION_RELEASE,
    ACTION_HOLD
} from './InputFeature'
import type {
    Binding,
    KeyBinding,
    MouseBinding,
    GamepadBinding,
    AxisBinding,
    VirtualBinding
} from './InputFeature'
import VirtualJoystick, {
    VIRTUAL_AXIS_X,
    VIRTUAL_AXIS_Y
} from './VirtualJoystick'
import type { JoystickConfig, ButtonConfig } from './VirtualJoystick'
import GestureRecognizer, {
    GESTURE_TAP,
    GESTURE_DOUBLE_TAP,
    GESTURE_LONG_PRESS,
    GESTURE_SWIPE,
    GESTURE_PINCH
} from './GestureRecognizer'
import type {
    GestureConfig,
    SwipeData,
    SwipeDirection
} from './GestureRecognizer'
import GamepadFeature, {
    GAMEPAD_CONNECTED,
    GAMEPAD_DISCONNECTED,
    GAMEPAD_BUTTON_DOWN,
    GAMEPAD_BUTTON_UP,
    MAPPING_XBOX,
    MAPPING_PS,
    MAPPING_SWITCH,
    MAPPING_STANDARD
} from './GamepadFeature'
import type { Mapping, MappingPreset } from './GamepadFeature'
import InputBuffer from './InputBuffer'
import type { BufferedInput } from './InputBuffer'

export {
    InputFeature,
    VirtualJoystick,
    GestureRecognizer,
    GamepadFeature,
    InputBuffer,
    ACTION_PRESS,
    ACTION_RELEASE,
    ACTION_HOLD,
    VIRTUAL_AXIS_X,
    VIRTUAL_AXIS_Y,
    GESTURE_TAP,
    GESTURE_DOUBLE_TAP,
    GESTURE_LONG_PRESS,
    GESTURE_SWIPE,
    GESTURE_PINCH,
    GAMEPAD_CONNECTED,
    GAMEPAD_DISCONNECTED,
    GAMEPAD_BUTTON_DOWN,
    GAMEPAD_BUTTON_UP,
    MAPPING_XBOX,
    MAPPING_PS,
    MAPPING_SWITCH,
    MAPPING_STANDARD
}

export type {
    Binding,
    KeyBinding,
    MouseBinding,
    GamepadBinding,
    AxisBinding,
    VirtualBinding,
    JoystickConfig,
    ButtonConfig,
    GestureConfig,
    SwipeData,
    SwipeDirection,
    Mapping,
    MappingPreset,
    BufferedInput
}
