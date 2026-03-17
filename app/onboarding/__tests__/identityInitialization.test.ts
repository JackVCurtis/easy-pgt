import { mapIdentityInitializationFailure } from '@/app/onboarding/identityInitialization';

describe('identity initialization failure mapping', () => {
  it('maps unavailable storage errors to blocked state', () => {
    expect(mapIdentityInitializationFailure(new Error('Secure storage unavailable'))).toEqual({
      status: 'blocked',
      errorMessage: 'Secure key storage is unavailable on this device.',
    });
  });

  it('maps corrupted keypair errors to blocked state', () => {
    expect(mapIdentityInitializationFailure(new Error('Identity keypair is corrupted'))).toEqual({
      status: 'blocked',
      errorMessage: 'Stored keypair appears corrupted. Retry initialization.',
    });
  });

  it('maps os denial errors to denied state', () => {
    expect(mapIdentityInitializationFailure(new Error('Permission denied by OS'))).toEqual({
      status: 'denied',
      errorMessage: 'OS denied secure key operations. Review permissions and retry.',
    });
  });

  it('maps auth-required errors to unlock guidance', () => {
    expect(mapIdentityInitializationFailure(new Error('Authentication required for keychain item'))).toEqual({
      status: 'denied',
      errorMessage: 'Unlock your device and approve secure storage access, then retry.',
    });
  });

  it('maps auth-canceled errors to unlock guidance', () => {
    expect(mapIdentityInitializationFailure(new Error('User canceled authentication prompt'))).toEqual({
      status: 'denied',
      errorMessage: 'Unlock your device and approve secure storage access, then retry.',
    });
  });

});
