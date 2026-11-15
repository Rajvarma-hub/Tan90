"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { recordLocation } from "@/features/deliveries/actions";

// Often enough to follow a vehicle, rarely enough to spare the battery and the API.
const SEND_EVERY_MS = 20_000;

type State =
  | { kind: "off" }
  | { kind: "waiting" }
  | { kind: "sharing"; sentAt: Date }
  | { kind: "problem"; message: string };

/** The driver's phone reports where the vehicle is while this is switched on. */
export function ShareLocation({ taskId }: { taskId: string }) {
  const [on, setOn] = useState(false);
  const [state, setState] = useState<State>({ kind: "off" });
  const lastSent = useRef(0);

  useEffect(() => {
    if (!on) return;
    if (!("geolocation" in navigator)) {
      queueMicrotask(() =>
        setState({ kind: "problem", message: "This device cannot share its location." }),
      );
      return;
    }
    lastSent.current = 0;
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSent.current < SEND_EVERY_MS) return;
        lastSent.current = now;
        void recordLocation({
          taskId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        }).then((result) =>
          setState(
            result.ok
              ? { kind: "sharing", sentAt: new Date() }
              : { kind: "problem", message: result.error.message },
          ),
        );
      },
      (error) =>
        setState({
          kind: "problem",
          message:
            error.code === error.PERMISSION_DENIED
              ? "Location is blocked. Allow it for this site in your browser settings."
              : "Could not get a position fix. Check that location is turned on.",
        }),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [on, taskId]);

  function toggle() {
    setState(on ? { kind: "off" } : { kind: "waiting" });
    setOn(!on);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium text-card-foreground">Share my location</p>
            <p className="text-sm text-muted-foreground">
              {state.kind === "off" && "Let Ops and the customer see where you are while you drive."}
              {state.kind === "waiting" && "Finding your position…"}
              {state.kind === "sharing" &&
                `Sharing. Last sent at ${state.sentAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}. Keep this page open.`}
              {state.kind === "problem" && state.message}
            </p>
          </div>
        </div>
        <Button variant={on ? "outline" : "primary"} onClick={toggle}>
          {on ? "Stop sharing" : "Start sharing"}
        </Button>
      </div>
    </Card>
  );
}
