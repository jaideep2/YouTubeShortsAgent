import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { VerticalLayoutMode } from '../types/edl';

export interface UltravioletTooltipProps {
  children: React.ReactNode;
  title: string;
  badgeText?: string;
  badgeTone?: 'ultraviolet' | 'emerald' | 'crimson' | 'lavender' | 'coral' | 'meadow' | 'honey';
  timecodeRange?: string;
  subtitle?: string;
  metrics?: Array<{ label: string; value: string; tone?: 'emerald' | 'crimson' | 'lavender' }>;
  framingDiagram?: VerticalLayoutMode;
  footerNote?: string;
  align?: 'left' | 'center' | 'right';
  fullWidth?: boolean;
}

export const UltravioletTooltip: React.FC<UltravioletTooltipProps> = ({
  children,
  title,
  badgeText,
  badgeTone = 'honey',
  timecodeRange,
  subtitle,
  metrics,
  framingDiagram,
  footerNote,
  align = 'center',
  fullWidth = false,
}) => {
  const [open, setOpen] = useState(false);

  const badgeColors: Record<string, string> = {
    ultraviolet: 'bg-[#F59E0B]/25 text-[#FDE68A] border border-[#F59E0B]/40',
    honey: 'bg-[#F59E0B]/25 text-[#FDE68A] border border-[#F59E0B]/40',
    emerald: 'bg-[#2D8A61]/30 text-[#A7F3D0] border border-[#2D8A61]/55',
    meadow: 'bg-[#2D8A61]/30 text-[#A7F3D0] border border-[#2D8A61]/55',
    crimson: 'bg-[#E05A47]/30 text-[#FECACA] border border-[#E05A47]/55',
    coral: 'bg-[#E05A47]/30 text-[#FECACA] border border-[#E05A47]/55',
    lavender: 'bg-[#FAF7F2]/15 text-[#FAF7F2] border border-[#FAF7F2]/25',
  };

  const alignClass =
    align === 'left'
      ? 'left-0'
      : align === 'right'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2';

  return (
    <span
      className={`relative ${fullWidth ? 'flex w-full' : 'inline-flex'} items-center`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 24 }}
            role="tooltip"
            className={`pointer-events-none absolute bottom-full mb-2.5 z-[600] w-72 p-3.5 text-left hum-tooltip-card ${alignClass}`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-semibold text-[#FAF7F2] truncate">
                {title}
              </span>
              {badgeText && (
                <span
                  className={`px-2 py-0.5 text-[10px] rounded-full font-semibold shrink-0 ${
                    badgeColors[badgeTone] || badgeColors.honey
                  }`}
                >
                  {badgeText}
                </span>
              )}
            </div>

            {timecodeRange && (
              <div className="mono-code text-[11px] text-[#FDE68A] mb-1.5 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                <span>{timecodeRange}</span>
              </div>
            )}

            {subtitle && (
              <p className="text-xs leading-relaxed text-[#E8E0D2] mb-2">
                {subtitle}
              </p>
            )}

            {framingDiagram && (
              <div className="my-2 p-2.5 rounded-xl bg-[#2B2620] border border-[#FAF7F2]/15 flex items-center gap-3">
                <div className="w-9 h-16 rounded-lg border border-[#F59E0B]/50 bg-[#1F1C18] overflow-hidden flex flex-col shrink-0">
                  {framingDiagram === 'SINGLE_SPEAKER' && (
                    <div className="flex-1 flex flex-col items-center justify-center bg-[#F59E0B]/20 text-[8px] font-semibold text-[#FDE68A]">
                      <span>100%</span>
                      <span>1 FACE</span>
                    </div>
                  )}
                  {framingDiagram === 'SPLIT_TOP_BOTTOM' && (
                    <>
                      <div className="h-1/2 border-b border-[#F59E0B]/45 bg-[#E05A47]/25 flex items-center justify-center text-[8px] font-semibold text-[#FECACA]">
                        TOP
                      </div>
                      <div className="h-1/2 bg-[#2D8A61]/25 flex items-center justify-center text-[8px] font-semibold text-[#A7F3D0]">
                        BOTTOM
                      </div>
                    </>
                  )}
                  {framingDiagram === 'CONTENT_ZOOM_PIP' && (
                    <>
                      <div className="h-[70%] border-b border-[#F59E0B]/45 bg-[#F59E0B]/20 flex items-center justify-center text-[8px] font-semibold text-[#FDE68A]">
                        SCREEN
                      </div>
                      <div className="h-[30%] bg-[#2D8A61]/25 flex items-center justify-center text-[8px] font-semibold text-[#A7F3D0]">
                        FACE
                      </div>
                    </>
                  )}
                </div>
                <div className="text-[11px] leading-snug text-[#FAF7F2]">
                  {framingDiagram === 'SINGLE_SPEAKER' && (
                    <>
                      <div className="font-semibold text-[#FDE68A]">Just 1 Speaker</div>
                      <div className="text-[#E8E0D2]">
                        Keeps the person talking right in the middle of the vertical screen.
                      </div>
                    </>
                  )}
                  {framingDiagram === 'SPLIT_TOP_BOTTOM' && (
                    <>
                      <div className="font-semibold text-[#FDE68A]">Top &amp; Bottom Split</div>
                      <div className="text-[#E8E0D2]">
                        Stacks both speakers so viewers see the joke AND the laugh together!
                      </div>
                    </>
                  )}
                  {framingDiagram === 'CONTENT_ZOOM_PIP' && (
                    <>
                      <div className="font-semibold text-[#FDE68A]">Screen Share + Face</div>
                      <div className="text-[#E8E0D2]">
                        Zooms into what you&apos;re showing on top with your reaction underneath.
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {metrics && metrics.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-[#FAF7F2]/15">
                {metrics.map((m, idx) => (
                  <div key={idx} className="bg-[#2B2620] px-2.5 py-1.5 rounded-lg">
                    <div className="text-[10px] text-[#E8E0D2]/80">{m.label}</div>
                    <div
                      className={`text-xs font-semibold ${
                        m.tone === 'emerald'
                          ? 'text-[#6EE7B7]'
                          : m.tone === 'crimson'
                          ? 'text-[#FCA5A5]'
                          : 'text-[#FDE68A]'
                      }`}
                    >
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {footerNote && (
              <div className="mt-2 pt-1.5 border-t border-[#FAF7F2]/15 text-[11px] text-[#FDE68A]">
                {footerNote}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
};
