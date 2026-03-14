import type { ViewStyle } from 'react-native';
import { Platform } from 'react-native';

const ANDROID_THREE_BUTTON_NAV_EXTRA_BOTTOM_PADDING = 20;
const ANDROID_TAB_BAR_HEIGHT = 80;
const ANDROID_TAB_BAR_TOP_PADDING = 8;

export function getBottomTabBarStyle(platform: string = Platform.OS): ViewStyle {
  if (platform === 'android') {
    return {
      paddingBottom: ANDROID_THREE_BUTTON_NAV_EXTRA_BOTTOM_PADDING,
      paddingTop: ANDROID_TAB_BAR_TOP_PADDING,
      height: ANDROID_TAB_BAR_HEIGHT,
    };
  }

  return {};
}
