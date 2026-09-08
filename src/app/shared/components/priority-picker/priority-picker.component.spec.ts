import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PriorityPickerComponent } from './priority-picker.component';
import { Priority } from '../../../core/models/task.model';

describe('PriorityPickerComponent', () => {
  async function setup(value: Priority = 'Medium') {
    await TestBed.configureTestingModule({ imports: [PriorityPickerComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PriorityPickerComponent);
    (fixture.componentRef as ComponentRef<PriorityPickerComponent>).setInput('value', value);
    fixture.detectChanges();
    return fixture;
  }

  it('marks the selected option with aria-checked', async () => {
    const fixture = await setup('High');
    const buttons = [...fixture.nativeElement.querySelectorAll('[role=radio]')] as HTMLButtonElement[];
    const high = buttons.find((b) => b.textContent?.includes('High'))!;
    expect(high.getAttribute('aria-checked')).toBe('true');
    const low = buttons.find((b) => b.textContent?.includes('Low'))!;
    expect(low.getAttribute('aria-checked')).toBe('false');
  });

  it('emits valueChange when another option is clicked', async () => {
    const fixture = await setup('Medium');
    let picked: Priority | undefined;
    fixture.componentInstance.valueChange.subscribe((v) => (picked = v));
    const buttons = [...fixture.nativeElement.querySelectorAll('[role=radio]')] as HTMLButtonElement[];
    buttons.find((b) => b.textContent?.includes('Urgent'))!.click();
    expect(picked).toBe('Urgent');
  });
});
