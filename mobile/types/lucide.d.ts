declare module 'lucide-react-native' {
  import React from 'react';
  import { ViewStyle } from 'react-native';

  export interface IconProps {
    color?: any;
    size?: number;
    style?: ViewStyle | ViewStyle[] | any;
    strokeWidth?: number;
  }

  export type Icon = React.ComponentType<IconProps>;

  export const LayoutDashboard: Icon;
  export const Briefcase: Icon;
  export const Receipt: Icon;
  export const FileText: Icon;
  export const Settings: Icon;
  export const Plus: Icon;
  export const Trash2: Icon;
  export const Edit3: Icon;
  export const X: Icon;
  export const UserCheck: Icon;
  export const Users: Icon;
  export const Percent: Icon;
  export const ArrowUpRight: Icon;
  export const ArrowDownLeft: Icon;
  export const Filter: Icon;
  export const UploadCloud: Icon;
  export const CheckCircle2: Icon;
  export const XCircle: Icon;
  export const User: Icon;
  export const Moon: Icon;
  export const Sun: Icon;
  export const Fingerprint: Icon;
  export const LogOut: Icon;
  export const Info: Icon;
  export const Laptop: Icon;
  export const Coins: Icon;
  export const MessageSquare: Icon;
  export const Eye: Icon;
  export const EyeOff: Icon;
  export const ChevronDown: Icon;
  export const Calendar: Icon;
  export const ShieldCheck: Icon;
  export const Share2: Icon;
  export const TrendingUp: Icon;
  export const AlertCircle: Icon;
  export const PlusCircle: Icon;
  export const Upload: Icon;
  export const Clipboard: Icon;
  export const Mail: Icon;
  export const Send: Icon;
}
