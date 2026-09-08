import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ForceChangePasswordComponent } from './force-change-password.component';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';

describe('ForceChangePasswordComponent', () => {
  const auth = {
    isAuthenticated: vi.fn().mockReturnValue(true),
    mustChangePassword: vi.fn().mockReturnValue(true),
    completePasswordReset: vi.fn(),
    logout: vi.fn(),
  };
  const toast = { show: vi.fn() };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [ForceChangePasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ForceChangePasswordComponent);
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
    return { fixture, cmp: fixture.componentInstance, nav };
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    auth.completePasswordReset.mockReset();
    auth.mustChangePassword.mockReturnValue(true);
    toast.show.mockReset();
  });

  it('blocks submit until the policy + match pass', async () => {
    const { cmp } = await setup();
    cmp.form.setValue({ newPassword: 'weak', confirmNewPassword: 'nope' });
    cmp.submit();
    expect(auth.completePasswordReset).not.toHaveBeenCalled();
    expect(cmp.form.invalid).toBe(true);
  });

  it('completes the reset, toasts, clears fields and navigates home', async () => {
    const { cmp, nav } = await setup();
    auth.completePasswordReset.mockReturnValue(of({ success: true, message: 'Your new password is set.', data: { accessToken: 'x' } }));

    cmp.form.setValue({ newPassword: 'BrandNew99', confirmNewPassword: 'BrandNew99' });
    cmp.submit();

    expect(auth.completePasswordReset).toHaveBeenCalledWith({
      newPassword: 'BrandNew99', confirmNewPassword: 'BrandNew99',
    });
    expect(toast.show).toHaveBeenCalledWith('success', 'Your new password is set.');
    expect(cmp.form.getRawValue()).toEqual({ newPassword: '', confirmNewPassword: '' });
    expect(nav).toHaveBeenCalledWith('/dashboard');
  });

  it('surfaces a server validation error on the field', async () => {
    const { cmp } = await setup();
    auth.completePasswordReset.mockReturnValue(
      throwError(() => ({ status: 400, message: 'x', errors: [{ field: 'newPassword', message: 'Choose a password you haven’t used before.' }] })),
    );

    cmp.form.setValue({ newPassword: 'BrandNew99', confirmNewPassword: 'BrandNew99' });
    cmp.submit();

    expect(cmp.form.controls.newPassword.errors?.['server']).toContain('used before');
    expect(cmp.submitting()).toBe(false);
  });

  it('does not double-submit', async () => {
    const { cmp } = await setup();
    auth.completePasswordReset.mockReturnValue({ subscribe: () => ({ unsubscribe() {} }) } as never);
    cmp.form.setValue({ newPassword: 'BrandNew99', confirmNewPassword: 'BrandNew99' });
    cmp.submit();
    cmp.submit();
    expect(auth.completePasswordReset).toHaveBeenCalledTimes(1);
  });
});
