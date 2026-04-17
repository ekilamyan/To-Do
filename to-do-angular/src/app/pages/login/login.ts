import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';
import { AuthService } from '../../services/auth.service';

type LoginView = 'login' | 'signup' | 'forgot';

interface Message {
  text: string;
  type: 'error' | 'success';
}

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pass    = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pass === confirm ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);

  readonly view    = signal<LoginView>('login');
  readonly loading = signal<boolean>(false);
  readonly message = signal<Message | null>(null);

  readonly showLoginPassword   = signal(false);
  readonly showSignupPassword  = signal(false);
  readonly showSignupConfirm   = signal(false);

  readonly loginForm = new FormGroup({
    email:    new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)])
  });

  readonly signupForm = new FormGroup({
    email:           new FormControl('', [Validators.required, Validators.email]),
    password:        new FormControl('', [Validators.required, Validators.minLength(8)]),
    confirmPassword: new FormControl('', [Validators.required])
  }, { validators: passwordMatchValidator });

  readonly forgotForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email])
  });

  setView(v: LoginView): void {
    this.view.set(v);
    this.message.set(null);
  }

  async onLogin(): Promise<void> {
    if (this.loginForm.invalid) { this.loginForm.markAllAsTouched(); return; }
    this.loading.set(true);
    this.message.set(null);

    const error = await this.auth.signIn(
      this.loginForm.value.email!,
      this.loginForm.value.password!
    );

    if (error) {
      this.message.set({ text: error.message, type: 'error' });
    } else {
      this.router.navigate(['/active']);
    }
    this.loading.set(false);
  }

  async onSignup(): Promise<void> {
    if (this.signupForm.invalid) { this.signupForm.markAllAsTouched(); return; }
    this.loading.set(true);
    this.message.set(null);

    const { error, needsConfirmation } = await this.auth.signUp(
      this.signupForm.value.email!,
      this.signupForm.value.password!
    );

    if (error) {
      this.message.set({ text: error.message, type: 'error' });
    } else if (needsConfirmation) {
      this.message.set({ text: 'Account created! Check your email to confirm before signing in.', type: 'success' });
    } else {
      this.router.navigate(['/active']);
    }
    this.loading.set(false);
  }

  async onForgot(): Promise<void> {
    if (this.forgotForm.invalid) { this.forgotForm.markAllAsTouched(); return; }
    this.loading.set(true);
    this.message.set(null);

    const error = await this.auth.resetPassword(this.forgotForm.value.email!);

    this.message.set(error
      ? { text: error.message, type: 'error' }
      : { text: 'Password reset email sent. Check your inbox.', type: 'success' }
    );
    this.loading.set(false);
  }
}
