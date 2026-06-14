import React from 'react';
import TabScrollButton from '@mui/material/TabScrollButton';
import type { TabScrollButtonProps } from '@mui/material/TabScrollButton';

/** MUI Tabs wrap scroll buttons in Tooltip; disabled buttons need a span wrapper. */
export const WrapTabScrollButton = React.forwardRef<HTMLSpanElement, TabScrollButtonProps>(
  function WrapTabScrollButton(props, ref) {
    return (
      <span ref={ref} style={{ display: 'inline-flex' }}>
        <TabScrollButton {...props} />
      </span>
    );
  }
);
