import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialogComponent {
  title        = input.required<string>();
  message      = input.required<string>();
  confirmLabel = input<string>('Confirm');

  confirmed  = output<void>();
  cancelled  = output<void>();
}
