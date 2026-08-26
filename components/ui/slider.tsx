"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-valuetext": ariaValueText,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow overflow-hidden rounded-full bg-black/[0.07] data-horizontal:h-2.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-2.5 dark:bg-white/[0.1]"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-black select-none data-horizontal:h-full data-vertical:w-full dark:bg-white"
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-valuetext={ariaValueText}
          className="relative block size-5 shrink-0 rounded-full border-[3px] border-white bg-black shadow-[0_8px_22px_-14px_rgba(0,0,0,0.8)] ring-black/15 transition-[color,box-shadow,transform] select-none after:absolute after:-inset-3 hover:scale-110 hover:ring-4 focus-visible:scale-110 focus-visible:ring-4 focus-visible:outline-hidden active:scale-95 disabled:pointer-events-none disabled:opacity-50 dark:border-[#171512] dark:bg-white dark:ring-white/15"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
