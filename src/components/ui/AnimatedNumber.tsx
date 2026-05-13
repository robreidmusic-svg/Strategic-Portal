import React, { useEffect, useState, useRef } from 'react';
import { motion, useSpring, useTransform, animate } from 'motion/react';
import { formatCurrency, cn } from '../../lib/utils';

interface AnimatedNumberProps {
  value: number;
  className?: string;
}

export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const previousValue = useRef(value);
  const count = useSpring(value, {
    mass: 1,
    stiffness: 100,
    damping: 30,
  });

  useEffect(() => {
    count.set(value);
  }, [value, count]);

  const display = useTransform(count, (latest) => 
    formatCurrency(Math.floor(latest))
  );

  return (
    <motion.h3 className={cn("font-mono", className)}>
      {display}
    </motion.h3>
  );
}
