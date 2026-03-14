import { getBottomTabBarStyle } from '@/app/navigation/tab-bar-style';

describe('getBottomTabBarStyle', () => {
  it('adds accessible Android spacing so tabs sit above three-button navigation', () => {
    expect(getBottomTabBarStyle('android')).toEqual({
      paddingBottom: 20,
      paddingTop: 8,
      height: 80,
    });
  });

  it('does not add extra spacing on iOS', () => {
    expect(getBottomTabBarStyle('ios')).toEqual({});
  });
});
