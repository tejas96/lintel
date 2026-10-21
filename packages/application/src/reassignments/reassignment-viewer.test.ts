import { describe, expect, it } from 'vitest';
import { withReassignmentActions } from './reassignment-viewer.query';
import { reassignmentDeciders } from './request-reassignment.command';

describe('who decides a reassignment request', () => {
  it('asks the project manager', () => {
    expect(reassignmentDeciders({ managerUserId: 'pm', ownerUserId: 'owner' }, 'meera')).toEqual([
      'pm',
    ]);
  });

  it('asks the project owner when the manager is the one asking', () => {
    expect(reassignmentDeciders({ managerUserId: 'pm', ownerUserId: 'owner' }, 'pm')).toEqual([
      'owner',
    ]);
  });

  it('never asks the person who asked', () => {
    expect(reassignmentDeciders({ managerUserId: 'pm', ownerUserId: 'pm' }, 'pm')).toEqual([]);
  });
});

describe('what a viewer may do with each request', () => {
  const requests = [
    { id: 'r1', status: 'open' as const, requestedBy: { id: 'meera' } },
    { id: 'r2', status: 'declined' as const, requestedBy: { id: 'kabir' } },
  ];

  it('lets a manager decide open requests made by others', () => {
    const [open, closed] = withReassignmentActions(requests, {
      userId: 'pm',
      managesProject: true,
    });
    expect(open).toMatchObject({ viewerCanDecide: true, viewerCanWithdraw: false });
    expect(closed).toMatchObject({ viewerCanDecide: false, viewerCanWithdraw: false });
  });

  it('lets the requester withdraw but never decide their own request', () => {
    const [own] = withReassignmentActions(requests, { userId: 'meera', managesProject: true });
    expect(own).toMatchObject({ viewerCanDecide: false, viewerCanWithdraw: true });
  });

  it('gives people who do not manage the project nothing to decide', () => {
    const [open] = withReassignmentActions(requests, { userId: 'kabir', managesProject: false });
    expect(open).toMatchObject({ viewerCanDecide: false, viewerCanWithdraw: false });
  });
});
