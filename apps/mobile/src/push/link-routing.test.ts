import { describe, expect, it } from 'vitest';
import { hrefForLinkPath } from './link-routing';

const ID = '9f5238fa-7b2e-4015-846a-340fa7f999a2';

describe('hrefForLinkPath', () => {
  it('opens records the server links to', () => {
    expect(hrefForLinkPath(`/tasks/${ID}`)).toEqual({
      pathname: '/tasks/[id]',
      params: { id: ID },
    });
    expect(hrefForLinkPath(`/deliverables/${ID}`)).toEqual({
      pathname: '/deliverables/[id]',
      params: { id: ID },
    });
    expect(hrefForLinkPath(`/leave/requests/${ID}`)).toEqual({
      pathname: '/leave/[id]',
      params: { id: ID },
    });
    expect(hrefForLinkPath(`/leave/${ID}`)).toEqual({
      pathname: '/leave/[id]',
      params: { id: ID },
    });
  });

  it('ignores query strings and sub-paths after the id', () => {
    expect(hrefForLinkPath(`/projects/${ID}?tab=scope`)).toEqual({
      pathname: '/projects/[id]',
      params: { id: ID },
    });
    expect(hrefForLinkPath(`/projects/${ID}/scope-changes`)).toEqual({
      pathname: '/projects/[id]',
      params: { id: ID },
    });
  });

  it('keeps why a task link was sent: the late-start nudge or a new-date request', () => {
    const REQUEST = '4b7c0a52-61f3-4a8e-9a55-0e2f3f1d8c10';
    expect(hrefForLinkPath(`/tasks/${ID}?nudge=late-start`)).toEqual({
      pathname: '/tasks/[id]',
      params: { id: ID, nudge: 'late-start' },
    });
    expect(hrefForLinkPath(`/tasks/${ID}?dateRequest=${REQUEST.toUpperCase()}`)).toEqual({
      pathname: '/tasks/[id]',
      params: { id: ID, dateRequest: REQUEST },
    });
    expect(hrefForLinkPath(`/tasks/${ID}?nudge=other&dateRequest=nope&tab=files`)).toEqual({
      pathname: '/tasks/[id]',
      params: { id: ID },
    });
  });

  it('maps section links and refuses what the app has no screen for', () => {
    expect(hrefForLinkPath('/approvals')).toBe('/approvals');
    expect(hrefForLinkPath('/notifications')).toBe('/inbox');
    expect(hrefForLinkPath(null)).toBeNull();
    expect(hrefForLinkPath('/tasks/not-a-uuid')).toBeNull();
  });

  it('opens my rewards, but leaves reviewing and policies to the web', () => {
    expect(hrefForLinkPath('/rewards')).toBe('/rewards');
    expect(hrefForLinkPath('/rewards/')).toBe('/rewards');
    expect(hrefForLinkPath('/rewards?from=push')).toBe('/rewards');
    expect(hrefForLinkPath('/rewards/review')).toBeNull();
    expect(hrefForLinkPath('/rewards/review?kind=milestones')).toBeNull();
    expect(hrefForLinkPath('/rewards/policies')).toBeNull();
  });
});
