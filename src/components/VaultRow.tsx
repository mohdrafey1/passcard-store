import React, { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Monogram } from '@/components/ui/Layout';
import type { VaultItem } from '@/features/vault/items';
import { space, useTheme } from '@/theme';
import { expiryState } from '@/utils/cards';

interface VaultRowProps {
  item: VaultItem;
  onOpen: () => void;
  onCopy: () => void;
  onFavorite: () => void;
  onMore: () => void;
  onDelete: () => void;
}

/**
 * One login or card. Copy is a visible button; swipe right to copy, left to
 * favourite; long-press for everything else. The same actions are offered to
 * screen readers as accessibility actions.
 */
export function VaultRow({ item, onOpen, onCopy, onFavorite, onMore, onDelete }: VaultRowProps) {
  const c = useTheme();
  const swipe = useRef<SwipeableMethods>(null);
  const copyWhat = item.kind === 'login' ? 'password' : 'card number';
  const favorite = item.entry.favorite;
  const expiry = item.kind === 'card' ? expiryState(item.entry.expiryMonth, item.entry.expiryYear) : 'valid';

  const action = (side: 'left' | 'right') => (
    <View
      style={[
        styles.action,
        side === 'left' ? { backgroundColor: c.brass, alignItems: 'flex-start' } : { backgroundColor: c.raised, alignItems: 'flex-end' },
      ]}
    >
      <View style={styles.actionInner}>
        <Icon name={side === 'left' ? 'copy' : 'star'} size={20} color={side === 'left' ? c.onBrass : c.brassText} />
        <AppText variant="label" style={{ color: side === 'left' ? c.onBrass : c.brassText }}>
          {side === 'left' ? 'Copy' : favorite ? 'Unfavourite' : 'Favourite'}
        </AppText>
      </View>
    </View>
  );

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={1.6}
      leftThreshold={72}
      rightThreshold={72}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => action('left')}
      renderRightActions={() => action('right')}
      onSwipeableWillOpen={(direction) => {
        // Act as soon as the swipe is released past the threshold, then spring
        // back. `direction` is where the row moves: 'right' reveals the left action.
        if (String(direction) === 'right') onCopy();
        else onFavorite();
        swipe.current?.close();
      }}
    >
      <View style={[styles.row, { backgroundColor: c.ground, borderBottomColor: c.divider }]}>
        <Pressable
          onPress={onOpen}
          onLongPress={() => {
            // A long press can start while the row is partly swiped; settle it first.
            swipe.current?.close();
            onMore();
          }}
          delayLongPress={350}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, ${item.subtitle}${favorite ? ', favourite' : ''}`}
          accessibilityHint="Opens details"
          accessibilityActions={[
            { name: 'copy', label: `Copy ${copyWhat}` },
            { name: 'favorite', label: favorite ? 'Remove from favourites' : 'Add to favourites' },
            { name: 'more', label: 'More actions' },
            { name: 'delete', label: 'Delete' },
          ]}
          onAccessibilityAction={(e) => {
            const name = e.nativeEvent.actionName;
            if (name === 'copy') onCopy();
            else if (name === 'favorite') onFavorite();
            else if (name === 'more') onMore();
            else if (name === 'delete') onDelete();
          }}
          style={({ pressed }) => [styles.main, pressed && { opacity: 0.7 }]}
        >
          <Monogram name={item.title} />
          <View style={styles.text}>
            <View style={styles.titleLine}>
              <AppText variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                {item.title}
              </AppText>
              {favorite ? <Icon name="star-filled" size={14} color={c.brassText} /> : null}
              {expiry === 'expired' ? <Badge label="Expired" tone="danger" /> : null}
              {expiry === 'expiring' ? <Badge label="Expiring" tone="warn" /> : null}
            </View>
            <AppText variant="caption" tone="muted" numberOfLines={1} style={{ fontSize: 14 }}>
              {item.subtitle || ' '}
            </AppText>
          </View>
        </Pressable>
        <IconButton icon="copy" label={`Copy ${item.title} ${copyWhat}`} tone="brass" onPress={onCopy} size={20} />
      </View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.xl, paddingRight: space.sm, borderBottomWidth: 1 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md - 1, minHeight: 64 },
  text: { flex: 1, minWidth: 0, gap: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  action: { flex: 1, justifyContent: 'center' },
  actionInner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl },
});
