import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../core/auth/auth.service';

describe('ForgotPasswordComponent', () => {
  const auth = { getCaptchaConfig: vi.fn(), forgotPassword: vi.fn() };

  async function setup() {
    auth.getCaptchaConfig.mockReturnValue(
      of({ success: true, data: { provider: 'disabled', siteKey: '', devBypassToken: 'dev-token' } }),
    );
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();
    return { fixture, cmp: fixture.componentInstance };
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    auth.getCaptchaConfig.mockReset();
    auth.forgotPassword.mockReset();
  });

  it('auto-supplies the dev bypass token when CAPTCHA is disabled', async () => {
    const { cmp } = await setup();
    expect(cmp.captchaToken()).toBe('dev-token');
  });

  it('submits email + captcha token and shows the generic confirmation', async () => {
    const { cmp } = await setup();
    auth.forgotPassword.mockReturnValue(
      of({ success: true, message: 'If an account exists for this email address, we have sent reset instructions.', data: null }),
    );
    cmp.email = 'user@example.com';

    cmp.submit(new Event('submit'));

    expect(auth.forgotPassword).toHaveBeenCalledWith({ email: 'user@example.com', captchaToken: 'dev-token' });
    expect(cmp.done()).toBe(true);
    expect(cmp.message()).toContain('If an account exists');
  });

  it('shows an inline CAPTCHA error and clears the token on a captcha rejection', async () => {
    const { cmp } = await setup();
    auth.forgotPassword.mockReturnValue(
      throwError(() => ({ status: 400, message: 'x', errors: [{ field: 'captchaToken', message: 'CAPTCHA verification failed. Please try again.' }] })),
    );
    cmp.email = 'user@example.com';

    cmp.submit(new Event('submit'));

    expect(cmp.done()).toBe(false);
    expect(cmp.captchaError()).toContain('CAPTCHA verification failed');
    expect(cmp.captchaToken()).toBeNull();
  });

  it('will not submit without a captcha token', async () => {
    const { cmp } = await setup();
    cmp.captchaToken.set(null);
    cmp.email = 'user@example.com';

    cmp.submit(new Event('submit'));

    expect(auth.forgotPassword).not.toHaveBeenCalled();
    expect(cmp.captchaError()).toBeTruthy();
  });
});
