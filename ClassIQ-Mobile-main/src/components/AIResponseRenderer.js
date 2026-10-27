import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BOLD_RE = /\*\*(.+?)\*\*/g;

function renderInline(text, baseStyle, boldStyle) {
  const parts = [];
  let last = 0;
  let match;
  const re = new RegExp(BOLD_RE);
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<Text key={`t-${last}`} style={baseStyle}>{text.slice(last, match.index)}</Text>);
    }
    parts.push(<Text key={`b-${match.index}`} style={boldStyle}>{match[1]}</Text>);
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(<Text key={`t-end`} style={baseStyle}>{text.slice(last)}</Text>);
  }
  if (!parts.length) return [<Text key="plain" style={baseStyle}>{text}</Text>];
  return parts;
}

function parseBlocks(text) {
  const lines = (text || '').split('\n');
  const blocks = [];
  let bullets = [];
  let numbered = [];

  const flushBullets = () => {
    if (bullets.length) { blocks.push({ type: 'bullets', items: [...bullets] }); bullets = []; }
  };
  const flushNumbered = () => {
    if (numbered.length) { blocks.push({ type: 'numbered', items: [...numbered] }); numbered = []; }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushBullets();
      flushNumbered();
      continue;
    }

    if (/^#{1,3}\s+/.test(line)) {
      flushBullets(); flushNumbered();
      blocks.push({ type: 'heading', text: line.replace(/^#{1,3}\s+/, '') });
      continue;
    }

    if (/^Q:\s*/i.test(line)) {
      flushBullets(); flushNumbered();
      blocks.push({ type: 'flash-q', text: line.replace(/^Q:\s*/i, '') });
      continue;
    }
    if (/^A:\s*/i.test(line)) {
      flushBullets(); flushNumbered();
      blocks.push({ type: 'flash-a', text: line.replace(/^A:\s*/i, '') });
      continue;
    }

    if (/^[-•*]\s+/.test(line)) {
      flushNumbered();
      bullets.push(line.replace(/^[-•*]\s+/, ''));
      continue;
    }

    const numMatch = line.match(/^(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      flushBullets();
      numbered.push(numMatch[2]);
      continue;
    }

    if (/^✅|^Answer:/i.test(line)) {
      flushBullets(); flushNumbered();
      blocks.push({ type: 'answer', text: line });
      continue;
    }

    flushBullets(); flushNumbered();
    blocks.push({ type: 'paragraph', text: line });
  }

  flushBullets();
  flushNumbered();
  return blocks;
}

export default function AIResponseRenderer({ text, colors, isUser }) {
  if (isUser) {
    return <Text style={[styles.body, { color: '#fff' }]}>{text}</Text>;
  }

  const blocks = parseBlocks(text);
  const base = { color: colors.text, fontSize: 15, lineHeight: 22 };
  const bold = { color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: '700' };

  return (
    <View style={styles.wrap}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return (
              <View key={i} style={styles.headingWrap}>
                {renderInline(block.text, [styles.heading, { color: colors.purple }], { fontSize: 16, fontWeight: '800', color: colors.purple })}
              </View>
            );
          case 'bullets':
            return (
              <View key={i} style={styles.list}>
                {block.items.map((item, j) => (
                  <View key={j} style={styles.bulletRow}>
                    <Text style={[styles.bulletDot, { color: colors.primary }]}>•</Text>
                    <View style={styles.bulletText}>{renderInline(item, base, bold)}</View>
                  </View>
                ))}
              </View>
            );
          case 'numbered':
            return (
              <View key={i} style={styles.list}>
                {block.items.map((item, j) => (
                  <View key={j} style={styles.bulletRow}>
                    <Text style={[styles.numLabel, { color: colors.primary }]}>{j + 1}.</Text>
                    <View style={styles.bulletText}>{renderInline(item, base, bold)}</View>
                  </View>
                ))}
              </View>
            );
          case 'flash-q':
            return (
              <View key={i} style={[styles.flashCard, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
                <Text style={[styles.flashLabel, { color: colors.primary }]}>Q</Text>
                <View style={styles.flashText}>{renderInline(block.text, base, bold)}</View>
              </View>
            );
          case 'flash-a':
            return (
              <View key={i} style={[styles.flashCard, styles.flashAnswer, { backgroundColor: colors.success + '10', borderColor: colors.success + '25' }]}>
                <Text style={[styles.flashLabel, { color: colors.success }]}>A</Text>
                <View style={styles.flashText}>{renderInline(block.text, [styles.flashText, { color: colors.textSecondary }], bold)}</View>
              </View>
            );
          case 'answer':
            return (
              <View key={i} style={[styles.answerPill, { backgroundColor: colors.success + '15' }]}>
                <Text style={[styles.answerText, { color: colors.success }]}>{block.text}</Text>
              </View>
            );
          default:
            return (
              <View key={i} style={styles.paragraph}>
                {renderInline(block.text, base, bold)}
              </View>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  body: { fontSize: 15, lineHeight: 22 },
  heading: { fontSize: 16, fontWeight: '800', marginTop: 4, marginBottom: 2, letterSpacing: -0.2 },
  headingWrap: { marginTop: 4, marginBottom: 2 },
  paragraph: { marginVertical: 1 },
  list: { gap: 6, marginVertical: 2 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletDot: { fontSize: 18, lineHeight: 22, fontWeight: '700' },
  numLabel: { fontSize: 14, lineHeight: 22, fontWeight: '800', minWidth: 18 },
  bulletText: { flex: 1, fontSize: 15, lineHeight: 22 },
  flashCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 10, marginVertical: 2,
  },
  flashAnswer: { marginTop: -4 },
  flashLabel: { fontSize: 12, fontWeight: '900', width: 18, textAlign: 'center', marginTop: 2 },
  flashText: { flex: 1, fontSize: 14, lineHeight: 20 },
  answerPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  answerText: { fontSize: 13, fontWeight: '700' },
});
