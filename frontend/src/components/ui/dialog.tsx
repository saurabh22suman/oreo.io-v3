import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal = DialogPrimitive.Portal

export function DialogOverlay(props: React.ComponentProps<typeof DialogPrimitive.Overlay>){
  return (
    <DialogPrimitive.Overlay
      {...props}
      className={[
        'fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px]',
        props.className||''
      ].join(' ')}
    />
  )
}

export const DialogClose = DialogPrimitive.Close

export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>){
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        {...props}
        className={[
          'fixed z-50 grid w-full max-w-6xl gap-4 border border-gray-200 bg-white p-0 shadow-lg',
          'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md',
          className||''
        ].join(' ')}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>){
  return <div className={[ 'flex items-center justify-between border-b border-gray-200 px-4 py-3', className||'' ].join(' ')} {...props} />
}
// Use Radix primitives for accessible labelling
export const DialogTitle = React.forwardRef<HTMLHeadingElement, React.ComponentProps<typeof DialogPrimitive.Title>>(function DialogTitle(
  { className, ...props }, ref
){
  return (
    <DialogPrimitive.Title ref={ref} className={[ 'font-semibold text-base', className||'' ].join(' ')} {...props} />
  )
})
export const DialogDescription = React.forwardRef<HTMLParagraphElement, React.ComponentProps<typeof DialogPrimitive.Description>>(function DialogDescription(
  { className, ...props }, ref
){
  return (
    <DialogPrimitive.Description ref={ref} className={[ 'text-sm text-gray-600', className||'' ].join(' ')} {...props} />
  )
})
