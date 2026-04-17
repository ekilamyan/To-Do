import { Component, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { ThemeToggleComponent } from './components/theme-toggle/theme-toggle';
import { TabBarComponent } from './components/tab-bar/tab-bar';
import { SnackbarComponent } from './components/snackbar/snackbar';
import { UserMenuComponent } from './components/user-menu/user-menu';
import { PricingDialogComponent } from './components/pricing-dialog/pricing-dialog';
import { TaskService } from './services/task.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ThemeToggleComponent, TabBarComponent, SnackbarComponent, UserMenuComponent, PricingDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private router = inject(Router);
  protected taskService = inject(TaskService);
  protected authService = inject(AuthService);

  protected isActiveTab = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map((e: NavigationEnd) => e.urlAfterRedirects === '/active' || e.urlAfterRedirects === '/')
    ),
    { initialValue: true }
  );

  protected isLoginRoute = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url.startsWith('/login')),
      startWith(this.router.url.startsWith('/login'))
    ),
    { initialValue: this.router.url.startsWith('/login') }
  );

  protected isAdminRoute = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url.startsWith('/admin')),
      startWith(this.router.url.startsWith('/admin'))
    ),
    { initialValue: this.router.url.startsWith('/admin') }
  );

  onAddTask(): void {
    this.taskService.startCreatingTask(null);
  }
}
