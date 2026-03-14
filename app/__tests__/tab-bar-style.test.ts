import { getBottomTabBarStyle } from '@/app/navigation/tab-bar-style';

describe('getBottomTabBarStyle', () => {
  it('adds extra bottom padding and height on Android for three-button navigation spacing', () => {
    expect(getBottomTabBarStyle('android')).toEqual({
      paddingBottom: 12,
      height: 64,
    });
  });

  it('does not add extra spacing on iOS', () => {
    expect(getBottomTabBarStyle('ios')).toEqual({});
  });
});
