import { Brand } from "../ui/Brand.jsx";
import {
  LayoutDashboard,
  Wallet,
  Tags,
  Leaf,
  CircleHelp,
  ArrowUpRight,
  LogOut,
} from "lucide-react";
import { Spinner } from "../ui/Spinner.jsx";

export function Sidebar({
  user,
  view,
  onNavigate,
  onHelp,
  onSignOut,
  signingOut,
}) {
  return (
    <aside className="sidebar">
      <Brand />
      <div className="workspace-label">YOUR PERSONAL SPACE</div>
      <nav aria-label="Main navigation">
        {[
          { key: "overview", label: "Overview", icon: LayoutDashboard },
          { key: "expenses", label: "All expenses", icon: Wallet },
          { key: "categories", label: "Categories", icon: Tags },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={view === key ? "active" : ""}
            onClick={() => onNavigate(key)}
          >
            <Icon size={19} />
            <span>{label}</span>
            {view === key && <span className="nav-dot" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="gentle-note">
          <span className="leaf-circle">
            <Leaf size={22} />
          </span>
          <strong>
            Small habits.
            <br />
            Bigger peace of mind.
          </strong>
          <p>
            Checking in is a good start.
            <br />
            You’re already doing it.
          </p>
        </div>
        <button className="help-button" onClick={onHelp}>
          <CircleHelp size={18} />
          <span>A little help</span>
          <ArrowUpRight size={15} />
        </button>
        <div className="user-profile">
          <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <span>Personal account</span>
          </div>
          <button
            className="icon-button"
            onClick={onSignOut}
            disabled={signingOut}
            aria-label="Sign out"
          >
            {signingOut ? <Spinner /> : <LogOut size={17} />}
          </button>
        </div>
      </div>
    </aside>
  );
}
