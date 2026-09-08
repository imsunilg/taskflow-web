import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ChangePasswordDialogComponent } from './change-password-dialog.component';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';

describe('ChangePasswordDialogComponent', () => {
  const auth = { changePassword: vi.fn() };
  const toast = { show: vi.fn() };

  async function mount() {
    await TestBed.configureTestingModule({
      imports: [ChangePasswordDialogComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ChangePasswordDialogComponent);
    fixture.detectChanges();
    return { fixture, cmp: fixture.componentInstance };
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    auth.changePassword.mockReset();
    toast.show.mockReset();
  });

  const fill = (cmp: ChangePasswordDialogComponent, cur: string, next: string, confirm: string) =>
    cmp.form.setValue({ currentPassword: cur, newPassword: next, confirmNewPassword: confirm });

  it('blocks submit until the form is valid and never calls the API', async () => {
    const { cmp } = await mount();
    fill(cmp, '', 'weak', 'nope');
    cmp.submit();
    expect(auth.changePassword).not.toHaveBeenCalled();
    expect(cmp.form.invalid).toBe(true);
  });

  it('flags a new password identical to the current one', async () => {
    const { cmp } = await mount();
    fill(cmp, 'SamePass123', 'SamePass123', 'SamePass123');
    cmp.submit();
    expect(cmp.form.hasError('sameAsCurrent')).toBe(true);
    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it('flags a confirmation mismatch', async () => {
    const { cmp } = await mount();
    fill(cmp, 'OldPass123', 'BrandNew99', 'BrandNew98');
    cmp.submit();
    expect(cmp.form.hasError('mismatch')).toBe(true);
    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it('submits, toasts, clears the fields and closes on success', async () => {
    const { cmp } = await mount();
    auth.changePassword.mockReturnValue(of({ success: true, message: 'Your password has been changed.', data: { accessToken: 'x' } }));
    const closed = vi.fn();
    cmp.closed.subscribe(closed);

    fill(cmp, 'OldPass123', 'BrandNew99', 'BrandNew99');
    cmp.submit();

    expect(auth.changePassword).toHaveBeenCalledWith({
      currentPassword: 'OldPass123', newPassword: 'BrandNew99', confirmNewPassword: 'BrandNew99',
    });
    expect(toast.show).toHaveBeenCalledWith('success', 'Your password has been changed.');
    expect(cmp.form.getRawValue()).toEqual({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    expect(closed).toHaveBeenCalled();
    expect(cmp.submitting()).toBe(false);
  });

  it('keeps the dialog open and shows an inline error when the current password is wrong', async () => {
    const { cmp } = await mount();
    auth.changePassword.mockReturnValue(
      throwError(() => ({ status: 400, message: 'Current password is incorrect.', errors: [{ field: 'currentPassword', message: 'Current password is incorrect.' }] })),
    );
    const closed = vi.fn();
    cmp.closed.subscribe(closed);

    fill(cmp, 'WrongOld1', 'BrandNew99', 'BrandNew99');
    cmp.submit();

    expect(closed).not.toHaveBeenCalled();
    expect(cmp.form.controls.currentPassword.errors?.['server']).toBe('Current password is incorrect.');
    expect(cmp.submitting()).toBe(false);
  });

  it('does not double-submit while a request is in flight', async () => {
    const { cmp } = await mount();
    auth.changePassword.mockReturnValue({ subscribe: () => ({ unsubscribe() {} }) } as never);
    fill(cmp, 'OldPass123', 'BrandNew99', 'BrandNew99');
    cmp.submit();
    cmp.submit();
    expect(auth.changePassword).toHaveBeenCalledTimes(1);
  });

  it('toggles password visibility per field', async () => {
    const { cmp } = await mount();
    expect(cmp.show().current).toBe(false);
    cmp.toggle('current');
    expect(cmp.show().current).toBe(true);
    expect(cmp.show().next).toBe(false);
  });

  it('wipes fields on destroy', async () => {
    const { fixture, cmp } = await mount();
    fill(cmp, 'a', 'b', 'c');
    fixture.destroy();
    expect(cmp.form.getRawValue()).toEqual({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  });
});
