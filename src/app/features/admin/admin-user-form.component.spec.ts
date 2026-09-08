import { TestBed } from '@angular/core/testing';
import { AdminUserFormComponent, UserFormSave } from './admin-user-form.component';
import { AdminUser } from './admin.models';

function editUser(over: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'u-1', email: 'a@b.c', displayName: 'Alice', role: 'User', isActive: true,
    createdAt: '2026-09-01T00:00:00Z', lastLoginAt: null, deactivatedAt: null,
    isDeleted: false, deletedAt: null, ...over,
  };
}

async function mount(mode: 'create' | 'edit', user: AdminUser | null = null) {
  await TestBed.configureTestingModule({ imports: [AdminUserFormComponent] }).compileComponents();
  const fixture = TestBed.createComponent(AdminUserFormComponent);
  fixture.componentRef.setInput('mode', mode);
  fixture.componentRef.setInput('user', user);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance };
}

describe('AdminUserFormComponent', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('rejects a weak password and mismatched confirmation on create', async () => {
    const { cmp } = await mount('create');
    const saved: UserFormSave[] = [];
    cmp.save.subscribe((e) => saved.push(e));

    cmp.form.patchValue({ displayName: 'Bob', email: 'bob@e.c', password: 'weak', confirmPassword: 'nope' });
    cmp.submit();

    expect(saved).toHaveLength(0);
    expect(cmp.form.invalid).toBe(true);
  });

  it('emits a create payload when valid (no Admin confirm needed for a plain user)', async () => {
    const { cmp } = await mount('create');
    const saved: UserFormSave[] = [];
    cmp.save.subscribe((e) => saved.push(e));

    cmp.form.patchValue({
      displayName: 'Bob', email: 'bob@e.c', role: 'User',
      password: 'Passw0rd1', confirmPassword: 'Passw0rd1', isActive: true,
    });
    cmp.submit();

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ kind: 'create', data: { email: 'bob@e.c', role: 'User' } });
  });

  it('requires an explicit confirm step for a role change before emitting', async () => {
    const { cmp } = await mount('edit', editUser({ role: 'User' }));
    const saved: UserFormSave[] = [];
    cmp.save.subscribe((e) => saved.push(e));

    cmp.form.patchValue({ role: 'Admin' });
    cmp.submit();

    expect(saved).toHaveLength(0);
    expect(cmp.confirmItems().some((i) => i.includes('role'))).toBe(true);

    cmp.emit();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ kind: 'update', id: 'u-1', data: { role: 'Admin' } });
  });

  it('only includes a password reset when the admin opens that section', async () => {
    const { cmp } = await mount('edit', editUser());
    const saved: UserFormSave[] = [];
    cmp.save.subscribe((e) => saved.push(e));

    cmp.form.patchValue({ displayName: 'Alice R' });
    cmp.submit();

    expect(saved[0]).toMatchObject({ kind: 'update' });
    expect((saved[0] as { resetPassword?: unknown }).resetPassword).toBeUndefined();
  });
});
