import { Link, useNavigate } from "@tanstack/react-router";
import participantsIcon from "../../assets/icons/icon-participants.svg";
import playIcon from "../../assets/icons/icon-play.svg";
import prizesIcon from "../../assets/icons/icon-prizes.svg";
import winnersIcon from "../../assets/icons/icon-winners.svg";
import { Button } from "../../components/Button";
import { Wordmark } from "../../components/Wordmark";
import { useLogoutMutation } from "../auth/queries";

const items = [
  { to: "/admin/draw", label: "Draw", icon: playIcon },
  { to: "/admin/participants", label: "Participants", icon: participantsIcon },
  { to: "/admin/prizes", label: "Prizes", icon: prizesIcon },
  { to: "/admin/winners", label: "Winners", icon: winnersIcon },
] as const;

// The Figma icons carry fixed colors, so they are drawn as a mask and follow the item's text color.
function Icon({ src }: { src: string }) {
  const mask = `url(${src})`;
  return (
    <span
      aria-hidden="true"
      className="size-5 shrink-0 bg-current"
      style={{
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

export function Sidebar() {
  const navigate = useNavigate();
  const logout = useLogoutMutation();

  return (
    <aside className="sticky top-0 flex h-dvh w-65 shrink-0 flex-col gap-8 border-r border-black-700 bg-black-900 px-4 py-8">
      <Wordmark />

      <nav aria-label="Organizer" className="flex flex-col gap-1">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 rounded-md border px-4 py-3 text-label-md outline-offset-2 focus-visible:outline-2 focus-visible:outline-gold-300"
            activeProps={{
              className: "border-gold-dim bg-gold-wash text-gold-300",
              "aria-current": "page",
            }}
            inactiveProps={{ className: "border-transparent text-gold-muted hover:text-gold-300" }}
          >
            <Icon src={item.icon} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex-1" />

      <div className="flex flex-col gap-2">
        <Button variant="secondary" disabled title="Coming soon" className="w-full">
          Open big screen
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          disabled={logout.isPending}
          onClick={() => logout.mutate(undefined, { onSuccess: () => navigate({ to: "/login" }) })}
        >
          Log out
        </Button>
        {logout.isError && (
          <p role="alert" className="text-center text-body-sm text-error">
            Could not log out. Try again.
          </p>
        )}
      </div>
    </aside>
  );
}
