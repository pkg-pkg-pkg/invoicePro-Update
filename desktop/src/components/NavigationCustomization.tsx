import React from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  Button,
  Divider,
  Alert,
} from '@mui/material';
import {
  DragIndicator as DragIndicatorIcon,
  Dashboard as DashboardIcon,
  Inventory as InventoryIcon,
  People as PeopleIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Receipt as ReceiptIcon,
  ShoppingCart as ShoppingCartIcon,
  Payment as PaymentIcon,
  AccountBalance as AccountBalanceIcon,
  ReceiptLong as ReceiptLongIcon,
  Assessment as AssessmentIcon,
  Settings as SettingsIcon,
  Restore as RestoreIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  LocalOffer as LocalOfferIcon,
  BarChart as BarChartIcon,
  MenuBook as MenuBookIcon,
  CurrencyRupee as CurrencyRupeeIcon,
  Lightbulb as LightbulbIcon,
  Feedback as FeedbackIcon,
  ChatBubbleOutline as ChatBubbleOutlineIcon,
  BugReport as BugReportIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useNavigationCustomization, MenuItem } from '../hooks/useNavigationCustomization';
import GstStampIcon from './GstStampIcon';

const getNavIconGradient = (key: string) => {
  const k = key.toLowerCase();
  if (k.includes('dashboard')) return 'linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%)';
  if (k.includes('products') || k.includes('inventory')) return 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
  if (k.includes('customers') || k.includes('suppliers') || k.includes('people') || k.includes('parties'))
    return 'linear-gradient(135deg, #f97316 0%, #f43f5e 100%)';
  if (k.includes('transactions') || k.includes('invoices') || k.includes('receipt'))
    return 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)';
  if (k.includes('payments') || k.includes('payment')) return 'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)';
  if (k.includes('accounts') || k.includes('account')) return 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)';
  if (k.includes('expenses')) return 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)';
  if (k.includes('gst')) return 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)';
  if (k.includes('schemes')) return 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)';
  if (k.includes('reports') || k.includes('assessment')) return 'linear-gradient(135deg, #06b6d4 0%, #22c55e 100%)';
  if (k.includes('settings')) return 'linear-gradient(135deg, #64748b 0%, #334155 100%)';
  if (k.includes('feedback') || k.includes('support')) return 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)';
  if (k.includes('feature') || k.includes('request')) return 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)';
  return 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)';
};

const getNavIconBadgeSx = (options: { gradient: string; enabled: boolean; size?: number }) => {
  const size = options.size ?? 34;
  const iconSize = Math.max(16, Math.round(size * 0.58));

  return {
    width: size,
    height: size,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Math.max(8, Math.round(size * 0.28)),
    background: options.gradient,
    border: '1px solid rgba(255,255,255,0.38)',
    position: 'relative',
    overflow: 'hidden',
    filter: options.enabled ? 'none' : 'grayscale(0.85) brightness(0.9)',
    boxShadow: '0 8px 14px rgba(0,0,0,0.18)',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '48%',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.40), rgba(255,255,255,0.00))',
      zIndex: 0,
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -4px 10px rgba(0,0,0,0.28)',
      zIndex: 0,
    },
    '& svg': {
      position: 'relative',
      zIndex: 1,
      color: '#fff',
      fontSize: iconSize,
      filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.35))',
    },
  } as const;
};

const iconMap: Record<string, React.ComponentType<any>> = {
  Dashboard: DashboardIcon,
  Inventory: InventoryIcon,
  People: PeopleIcon,
  Person: PersonIcon,
  Business: BusinessIcon,
  Receipt: ReceiptIcon,
  ShoppingCart: ShoppingCartIcon,
  Payment: PaymentIcon,
  AccountBalance: AccountBalanceIcon,
  ReceiptLong: ReceiptLongIcon,
  Assessment: AssessmentIcon,
  AdminPanelSettings: PeopleIcon,
  Settings: SettingsIcon,
  Feedback: FeedbackIcon,
  Lightbulb: LightbulbIcon,
  ChatBubbleOutline: ChatBubbleOutlineIcon,
  BugReport: BugReportIcon,
  Message: MessageIcon,
};

const getNavIconComponent = (idOrKey: string | undefined, fallbackIconKey: string | undefined) => {
  const id = String(idOrKey ?? '').toLowerCase();

  const byId: Record<string, React.ComponentType<any>> = {
    dashboard: DashboardIcon,
    products: InventoryIcon,

    parties: PeopleIcon,
    customers: PersonIcon,
    suppliers: BusinessIcon,
    'party-ledger-report': MenuBookIcon,

    transactions: ReceiptIcon,
    invoices: ReceiptIcon,
    'purchase-invoices': ShoppingCartIcon,
    'credit-notes': UndoIcon,
    'debit-notes': RedoIcon,

    payments: PaymentIcon,
    accounts: AccountBalanceIcon,
    expenses: CurrencyRupeeIcon,
    gst: GstStampIcon,
    schemes: LocalOfferIcon,
    reports: BarChartIcon,
    settings: SettingsIcon,
    feedback: ChatBubbleOutlineIcon,
    'feedback-issues': BugReportIcon,
    'feature-request': LightbulbIcon,
  };

  const fromId = byId[id];
  if (fromId) return fromId;
  return iconMap[String(fallbackIconKey ?? '')] || SettingsIcon;
};

export default function NavigationCustomization() {
  const {
    menuItems,
    isLoaded,
    reorderMenuItems,
    toggleMenuItem,
    resetToDefaults,
  } = useNavigationCustomization();

  // Filter to only show MenuItems (not MenuGroups) in customization
  const customizableItems = menuItems.filter((item): item is MenuItem => 'path' in item);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    reorderMenuItems(result.source.index, result.destination.index);
  };

  const handleToggle = (id: string) => {
    toggleMenuItem(id);
  };

  const renderMenuItem = (item: MenuItem, index: number) => {
    const IconComponent = getNavIconComponent(item.id, item.icon);
    const gradient = getNavIconGradient(item.id || item.icon);

    return (
      <Draggable key={item.id} draggableId={item.id} index={index}>
        {(provided, snapshot) => (
          <ListItem
            ref={provided.innerRef}
            {...provided.draggableProps}
            sx={{
              bgcolor: snapshot.isDragging ? 'action.selected' : 'transparent',
              border: snapshot.isDragging ? '1px solid' : 'none',
              borderColor: 'divider',
              borderRadius: 1,
              mb: 1,
            }}
          >
            <ListItemIcon {...provided.dragHandleProps}>
              <DragIndicatorIcon color="action" />
            </ListItemIcon>
            <ListItemIcon sx={{ minWidth: 48 }}>
              <Box
                sx={{
                  ...getNavIconBadgeSx({ gradient, enabled: item.enabled, size: 32 }),
                  transform: snapshot.isDragging ? 'translateY(-1px)' : 'translateY(0px)',
                }}
              >
                <IconComponent />
              </Box>
            </ListItemIcon>
            <ListItemText
              primary={item.text}
              secondary={item.path}
              sx={{
                opacity: item.enabled ? 1 : 0.5,
                textDecoration: item.enabled ? 'none' : 'line-through',
              }}
            />
            <ListItemSecondaryAction>
              <Switch
                edge="end"
                checked={item.enabled}
                onChange={() => handleToggle(item.id)}
              />
            </ListItemSecondaryAction>
          </ListItem>
        )}
      </Draggable>
    );
  };

  if (!isLoaded) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading navigation preferences...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Navigation Customization
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Customize your navigation menu by reordering items and toggling visibility.
        Drag items to reorder them, and use the switches to show/hide menu options.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <strong>Tip:</strong> Disabled menu items will be hidden from your navigation sidebar.
        You can always re-enable them here.
      </Alert>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Menu Items
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="menu-items">
            {(provided) => (
              <List
                {...provided.droppableProps}
                ref={provided.innerRef}
                sx={{ minHeight: 400 }}
              >
                {customizableItems.map((item, index) => renderMenuItem(item, index))}
                {provided.placeholder}
              </List>
            )}
          </Droppable>
        </DragDropContext>
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<RestoreIcon />}
          onClick={resetToDefaults}
          color="secondary"
        >
          Reset to Defaults
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3, fontStyle: 'italic' }}>
        Changes are saved automatically. Your navigation preferences are specific to your user account.
      </Typography>
    </Box>
  );
}
