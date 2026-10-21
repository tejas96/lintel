import { type APIRequestContext, expect, request } from '@playwright/test';
import { E2E } from './environment';
import { type SessionRole, sessionFile } from './people';

interface Page<T> {
  readonly items: readonly T[];
}

/**
 * Arranges journey data through the same /api the web app uses, signed in as
 * a role (cookie session + double-submit CSRF header). Journeys then act and
 * assert only through the browser.
 */
export class StudioApi {
  private constructor(
    private readonly context: APIRequestContext,
    private readonly csrf: string,
  ) {}

  static async as(role: SessionRole): Promise<StudioApi> {
    const context = await request.newContext({
      baseURL: E2E.webUrl,
      storageState: sessionFile(role),
    });
    const state = await context.storageState();
    const csrf = state.cookies.find((cookie) => cookie.name === 'lintel_csrf')?.value ?? '';
    return new StudioApi(context, csrf);
  }

  async get<T>(path: string): Promise<T> {
    const response = await this.context.get(`/api/v1${path}`);
    expect(response.status(), `GET ${path}`).toBe(200);
    return (await response.json()) as T;
  }

  async post<T>(path: string, data: unknown, status = 201): Promise<T> {
    const response = await this.context.post(`/api/v1${path}`, {
      data,
      headers: { 'x-lintel-csrf': this.csrf },
    });
    expect(response.status(), `POST ${path}: ${await response.text()}`).toBe(status);
    return (await response.json()) as T;
  }

  async patch<T>(path: string, data: unknown): Promise<T> {
    const response = await this.context.patch(`/api/v1${path}`, {
      data,
      headers: { 'x-lintel-csrf': this.csrf },
    });
    expect(response.status(), `PATCH ${path}: ${await response.text()}`).toBe(200);
    return (await response.json()) as T;
  }

  async personId(fullName: string): Promise<string> {
    const query = new URLSearchParams({ search: fullName, page: '1', pageSize: '5' });
    const people = await this.get<Page<{ id: string; fullName: string }>>(`/people?${query}`);
    const person = people.items.find((candidate) => candidate.fullName === fullName);
    if (!person) throw new Error(`No person called ${fullName}.`);
    return person.id;
  }

  async projectId(name: string): Promise<string> {
    const query = new URLSearchParams({ search: name, page: '1', pageSize: '5' });
    const projects = await this.get<Page<{ id: string; name: string }>>(`/projects?${query}`);
    const project = projects.items.find((candidate) => candidate.name === name);
    if (!project) throw new Error(`No project called ${name}.`);
    return project.id;
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }
}

/** "YYYY-MM-DD" a number of days from today in the studio's timezone. */
export function studioDate(daysFromToday: number): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}
