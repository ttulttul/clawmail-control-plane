import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { InstanceActions } from "../src/components/instances/instance-actions";

describe("InstanceActions", () => {
  test("invokes the correct action callbacks for the selected instance", () => {
    const onProvisionMailchannels = vi.fn();
    const onProvisionInbox = vi.fn();
    const onRotateGatewayToken = vi.fn();
    const onSuspend = vi.fn();
    const onActivate = vi.fn();

    render(
      <InstanceActions
        instanceId="instance-123"
        onProvisionMailchannels={onProvisionMailchannels}
        onProvisionInbox={onProvisionInbox}
        onRotateGatewayToken={onRotateGatewayToken}
        onSuspend={onSuspend}
        onActivate={onActivate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Provision MailChannels" }));
    fireEvent.click(screen.getByRole("button", { name: "Provision Inbox" }));
    fireEvent.click(screen.getByRole("button", { name: "Rotate Gateway Token" }));
    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));

    expect(onProvisionMailchannels).toHaveBeenCalledWith("instance-123");
    expect(onProvisionInbox).toHaveBeenCalledWith("instance-123");
    expect(onRotateGatewayToken).toHaveBeenCalledWith("instance-123");
    expect(onSuspend).toHaveBeenCalledWith("instance-123");
    expect(onActivate).toHaveBeenCalledWith("instance-123");
  });
});
