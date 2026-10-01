'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import {
  subDays,
  addDays,
  isSameDay,
  startOfDay,
  format,
} from 'date-fns';
import {
  ViewMode,
  MAX_VISIBLE_DAYS,
  DAYS_PAST,
  DAYS_FUTURE,
  DAYS_TO_LOAD,
  MIN_DATE,
  SCROLL_THRESHOLD_FW,
  SCROLL_THRESHOLD_BK,
  STICKY_HEADER_HEIGHT,
} from './types';

export function useEpasaInfiniteScroll() {
  const [selectedDate, setSelectedDate]   = useState(new Date());
  const [viewMode, setViewMode]           = useState<ViewMode>('daily');
  const [visibleDays, setVisibleDays]     = useState<Date[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const visibleDaysRef     = useRef<Date[]>([]);
  const viewModeRef        = useRef<ViewMode>('daily');
  const loadingDirRef      = useRef<'idle' | 'fw' | 'bk'>('idle');
  const anchorDateStrRef   = useRef<string | null>(null);
  const anchorScrollTopRef = useRef<number | null>(null);
  const anchorOffsetTopRef = useRef<number | null>(null);

  useEffect(() => { visibleDaysRef.current = visibleDays; }, [visibleDays]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

  const formatDate = (d: Date) => format(d, 'yyyy-MM-dd');

  const scrollToDate = useCallback((date: Date, behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    const el = container?.querySelector<HTMLElement>(`[data-epasa-date="${formatDate(date)}"]`) ||
               document.querySelector<HTMLElement>(`[data-epasa-date="${formatDate(date)}"]`);
    if (!el || !container) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const scrollOffset = elRect.top - containerRect.top + container.scrollTop - STICKY_HEADER_HEIGHT;
    container.scrollTo({ top: Math.max(0, scrollOffset), behavior });
  }, []);

  const buildWindowAround = useCallback((center: Date): Date[] => {
    const days: Date[] = [];
    for (let i = DAYS_PAST; i > 0; i--) {
      const d = subDays(center, i);
      if (startOfDay(d) >= startOfDay(MIN_DATE)) days.push(d);
    }
    days.push(center);
    for (let i = 1; i <= DAYS_FUTURE; i++) days.push(addDays(center, i));
    return days;
  }, []);

  const navigateToDate = useCallback((date: Date) => {
    setSelectedDate(date);
    if (visibleDaysRef.current.some(d => isSameDay(d, date))) {
      setTimeout(() => scrollToDate(date, 'smooth'), 50);
    } else {
      setVisibleDays(buildWindowAround(date));
      setTimeout(() => scrollToDate(date, 'instant'), 200);
    }
  }, [buildWindowAround, scrollToDate]);

  const loadMoreDaysForward = useCallback(() => {
    if (loadingDirRef.current !== 'idle') return;
    const days = visibleDaysRef.current;
    if (days.length === 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const willTrimFromTop = days.length + DAYS_TO_LOAD > MAX_VISIBLE_DAYS;
    const anchorIndex = willTrimFromTop ? DAYS_TO_LOAD : 0;
    const anchorDay = days[anchorIndex];
    if (anchorDay) {
      const anchorDateStr = format(anchorDay, 'yyyy-MM-dd');
      const el = container.querySelector<HTMLElement>(`[data-epasa-date="${anchorDateStr}"]`);
      if (el) {
        anchorDateStrRef.current   = anchorDateStr;
        anchorOffsetTopRef.current = el.offsetTop;
        anchorScrollTopRef.current = container.scrollTop;
      }
    }

    loadingDirRef.current = 'fw';
    setVisibleDays(prev => {
      const last = prev[prev.length - 1];
      const newDays = Array.from({ length: DAYS_TO_LOAD }, (_, i) => addDays(last, i + 1));
      let updated = [...prev, ...newDays];
      if (updated.length > MAX_VISIBLE_DAYS) updated = updated.slice(updated.length - MAX_VISIBLE_DAYS);
      return updated;
    });
  }, []);

  const loadMoreDaysBackward = useCallback(() => {
    if (loadingDirRef.current !== 'idle') return;
    const days = visibleDaysRef.current;
    const firstDay = days[0];
    if (!firstDay || startOfDay(firstDay) <= startOfDay(MIN_DATE)) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const anchorDateStr = format(firstDay, 'yyyy-MM-dd');
    const el = container.querySelector<HTMLElement>(`[data-epasa-date="${anchorDateStr}"]`);
    const anchorOffsetTop = el ? el.offsetTop : 0;

    anchorDateStrRef.current   = anchorDateStr;
    anchorOffsetTopRef.current = anchorOffsetTop;
    anchorScrollTopRef.current = container.scrollTop;
    loadingDirRef.current      = 'bk';

    const newDays: Date[] = [];
    for (let i = DAYS_TO_LOAD; i > 0; i--) {
      const d = subDays(firstDay, i);
      if (startOfDay(d) >= startOfDay(MIN_DATE)) newDays.push(d);
    }
    if (newDays.length === 0) {
      loadingDirRef.current = 'idle';
      return;
    }

    setVisibleDays(prev => {
      let updated = [...newDays, ...prev];
      if (updated.length > MAX_VISIBLE_DAYS) updated = updated.slice(0, MAX_VISIBLE_DAYS);
      return updated;
    });
  }, []);

  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

  useIsomorphicLayoutEffect(() => {
    const dir = loadingDirRef.current;
    if (dir === 'idle') return;
    const container = scrollContainerRef.current;
    const anchorDate = anchorDateStrRef.current;
    if (container && anchorDate) {
      const el = container.querySelector<HTMLElement>(`[data-epasa-date="${anchorDate}"]`);
      if (el) {
        const prevOffsetTop = anchorOffsetTopRef.current ?? 0;
        const prevScrollTop = anchorScrollTopRef.current ?? 0;
        const newOffsetTop = el.offsetTop;
        const delta = newOffsetTop - prevOffsetTop;
        container.scrollTop = prevScrollTop + delta;
      }
    }
    anchorDateStrRef.current   = null;
    anchorOffsetTopRef.current = null;
    anchorScrollTopRef.current = null;
    loadingDirRef.current      = 'idle';
  }, [visibleDays]);

  const onScroll = useCallback(() => {
    if (viewModeRef.current !== 'daily') return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD_FW) loadMoreDaysForward();
    if (scrollTop < SCROLL_THRESHOLD_BK) loadMoreDaysBackward();
  }, [loadMoreDaysForward, loadMoreDaysBackward]);

  const setScrollRef = useCallback((el: HTMLDivElement | null) => {
    if (scrollContainerRef.current) scrollContainerRef.current.removeEventListener('scroll', onScroll);
    (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (el) {
      el.addEventListener('scroll', onScroll, { passive: true });
      requestAnimationFrame(() => {
        scrollToDate(selectedDate, 'instant');
      });
    }
  }, [onScroll, selectedDate, scrollToDate]);

  useEffect(() => {
    if (!isInitialized) {
      setVisibleDays(buildWindowAround(selectedDate));
      setIsInitialized(true);
    }
  }, [isInitialized, selectedDate, buildWindowAround]);

  return {
    selectedDate,
    setSelectedDate,
    viewMode,
    setViewMode,
    visibleDays,
    setVisibleDays,
    scrollContainerRef,
    setScrollRef,
    scrollToDate,
    navigateToDate,
  };
}
