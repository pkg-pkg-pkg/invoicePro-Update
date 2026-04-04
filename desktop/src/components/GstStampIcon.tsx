import { SvgIcon, SvgIconProps } from '@mui/material';

export default function GstStampIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" strokeWidth="4" />
      <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="2 4" />
      <g>
        <text
          x="32"
          y="38"
          textAnchor="middle"
          fontSize="20"
          fontWeight="700"
          fontFamily="Arial, sans-serif"
          fill="currentColor"
        >
          GST
        </text>
      </g>
    </SvgIcon>
  );
}
