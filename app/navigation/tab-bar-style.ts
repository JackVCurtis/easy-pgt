import type { ViewStyle } from 'react-native';
import { Platform } from 'react-native';

const ANDROID_THREE_BUTTON_NAV_EXTRA_BOTTOM_PADDING = 12;
const ANDROID_TAB_BAR_HEIGHT = 64;

export function getBottomTabBarStyle(platform: string = Platform.OS): ViewStyle {
  if (platform === 'android') {
    return {
      paddingBottom: ANDROID_THREE_BUTTON_NAV_EXTRA_BOTTOM_PADDING,
      height: ANDROID_TAB_BAR_HEIGHT,
    };
  }

  return {};
}
