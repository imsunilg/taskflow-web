import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminComponent } from './admin.component';
import { AdminApiService } from './admin-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AdminUser } from './admin.models';

function user(over: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'u-1', email: 'a@b.c', displayName: 'Alice', role: 'User', isActive: true,
    createdAt: '2026-09-01T00:00:00Z', lastLoginAt: null, deactivatedAt: null,
    isDeleted: false, deletedAt: null, ...over,
  };
}
const paged = (items: AdminUser[]) => ({
  success: true, message: '', data: { items, page: 1, pageSize: 20, total: items.length, totalPages: 1 }, errors: [], pagination: null,
});

describe('AdminComponent', () => {
  const api = {
    getSummary: vi.fn(),
    getUsers: vi.fn(),
    setStatus: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    resetPassword: vi.fn(),
    deleteUser: vi.fn(),
  };
  const auth = { currentUser: vi.fn() };
  const toast = { show: vi.fn() };

  async function setup(users: AdminUser[] = [user()]) {
    api.getSummary.mockReturnValue(
      of({ success: true, data: { totalUsers: 3, activeUsers: 2, deactivatedUsers: 1, newUsersLast7Days: 1 } }),
    );
    api.getUsers.mockReturnValue(of(paged(users)));
    await TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [
        { provide: AdminApiService, useValue: api },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.detectChanges();
    return { fixture, cmp: fixture.componentInstance };
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    api.getSummary.mockReset();
    api.getUsers.mockReset();
    api.setStatus.mockReset();
    api.createUser.mockReset();
    api.updateUser.mockReset();
    api.resetPassword.mockReset();
    api.deleteUser.mockReset();
    toast.show.mockReset();
    auth.currentUser.mockReturnValue({ id: 'admin-1', email: 'admin', displayName: 'Admin', role: 'Admin' });
  });

  it('loads the summary and user list on init', async () => {
    const { fixture, cmp } = await setup([user({ displayName: 'Alice' }), user({ id: 'u-2', displayName: 'Bob', isActive: false })]);
    expect(cmp.summary()?.totalUsers).toBe(3);
    expect(cmp.users().length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Alice');
    expect(fixture.nativeElement.textContent).toContain('Deactivated');
  });

  it('re-queries with the status filter', async () => {
    const { cmp } = await setup();
    api.getUsers.mockClear();
    cmp.setStatus('deactivated');
    expect(api.getUsers).toHaveBeenCalledWith(expect.objectContaining({ status: 'deactivated', page: 1 }));
  });

  it('confirms then deactivates a user, updates the row and toasts', async () => {
    const target = user({ id: 'u-9', displayName: 'Carol', isActive: true });
    const { cmp } = await setup([target]);
    api.setStatus.mockReturnValue(of({ success: true, message: 'User deactivated.', data: { ...target, isActive: false } }));

    cmp.ask(target, false);
    expect(cmp.pending()?.user.id).toBe('u-9');

    cmp.confirm(cmp.pending()!);

    expect(api.setStatus).toHaveBeenCalledWith('u-9', false);
    expect(cmp.users()[0].isActive).toBe(false);
    expect(cmp.pending()).toBeNull();
    expect(toast.show).toHaveBeenCalledWith('success', 'User deactivated.');
  });

  it('surfaces a server rejection (e.g. last admin) as an error toast', async () => {
    const target = user({ id: 'u-3', role: 'Admin' });
    const { cmp } = await setup([target]);
    api.setStatus.mockReturnValue(throwError(() => ({ status: 400, message: 'The last active admin account cannot be deactivated.', errors: [] })));

    cmp.confirm({ user: target, activate: false });

    expect(toast.show).toHaveBeenCalledWith('error', 'The last active admin account cannot be deactivated.');
    expect(cmp.pending()).toBeNull();
  });

  it('does not let an admin open the deactivate dialog for their own row', async () => {
    const me = user({ id: 'admin-1', displayName: 'Admin', role: 'Admin' });
    const { cmp } = await setup([me]);
    expect(cmp.isSelf(me)).toBe(true);

    cmp.ask(me, false);
    expect(cmp.pending()).toBeNull();
  });

  it('opens the create-user drawer', async () => {
    const { fixture, cmp } = await setup();
    expect(cmp.formMode()).toBeNull();
    cmp.openCreate();
    fixture.detectChanges();
    expect(cmp.formMode()).toBe('create');
    expect(fixture.nativeElement.textContent).toContain('Create user');
  });

  it('creates a user, then refreshes the table and toasts', async () => {
    const { cmp } = await setup();
    api.getUsers.mockClear();
    api.createUser.mockReturnValue(of({ success: true, message: 'User created.', data: user({ id: 'new-1' }) }));

    cmp.openCreate();
    cmp.onFormSave({
      kind: 'create',
      data: { displayName: 'New', email: 'n@e.c', role: 'User', password: 'Passw0rd', confirmPassword: 'Passw0rd', isActive: true },
    });

    expect(api.createUser).toHaveBeenCalled();
    expect(cmp.formMode()).toBeNull();
    expect(toast.show).toHaveBeenCalledWith('success', 'User created.');
    expect(api.getUsers).toHaveBeenCalled();
  });

  it('keeps the drawer open and shows the error when create fails (duplicate email)', async () => {
    const { cmp } = await setup();
    api.createUser.mockReturnValue(
      throwError(() => ({ status: 400, message: 'A user with this email already exists.', errors: [{ field: 'email', message: 'This email is already in use.' }] })),
    );

    cmp.openCreate();
    cmp.onFormSave({
      kind: 'create',
      data: { displayName: 'Dupe', email: 'a@b.c', role: 'User', password: 'Passw0rd', confirmPassword: 'Passw0rd', isActive: true },
    });

    expect(cmp.formMode()).toBe('create');
    expect(cmp.formError()).toContain('email is already in use');
  });

  it('soft-deletes a user via the confirm dialog and removes the row', async () => {
    const target = user({ id: 'u-del', displayName: 'Dan' });
    const { cmp } = await setup([target]);
    api.deleteUser.mockReturnValue(
      of({ success: true, message: 'User deleted.', data: { ...target, isDeleted: true, isActive: false } }),
    );

    cmp.askDelete(target);
    expect(cmp.pending()?.kind).toBe('delete');

    cmp.confirm(cmp.pending()!);

    expect(api.deleteUser).toHaveBeenCalledWith('u-del');
    expect(cmp.users().find((u) => u.id === 'u-del')).toBeUndefined();
    expect(toast.show).toHaveBeenCalledWith('success', 'User deleted.');
  });

  it('does not let an admin open the delete dialog for their own row', async () => {
    const me = user({ id: 'admin-1', role: 'Admin' });
    const { cmp } = await setup([me]);
    cmp.askDelete(me);
    expect(cmp.pending()).toBeNull();
  });

  it('shows an error state when the list fails to load', async () => {
    api.getSummary.mockReturnValue(of({ success: true, data: null }));
    api.getUsers.mockReturnValue(throwError(() => ({ status: 500, message: 'boom', errors: [] })));
    await TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [
        { provide: AdminApiService, useValue: api },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toBe('boom');
    expect(fixture.nativeElement.textContent).toContain('Retry');
  });
});
