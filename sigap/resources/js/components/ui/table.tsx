import * as React from 'react';

import { cn } from '@/lib/utils';

function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
    return (
        <div className="relative w-full overflow-x-auto">
            <table className={cn('w-full caption-bottom text-left text-sm', className)} {...props} />
        </div>
    );
}

function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
    return <thead className={cn('[&_tr]:border-b', className)} {...props} />;
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
    return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

function TableFooter({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
    return <tfoot className={cn('border-t bg-gray-50 font-medium', className)} {...props} />;
}

function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
    return (
        <tr
            className={cn(
                'border-b border-gray-100 transition-colors hover:bg-gray-50 data-[state=selected]:bg-gray-100',
                className,
            )}
            {...props}
        />
    );
}

function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
    return (
        <th
            className={cn(
                'h-11 px-5 text-left align-middle text-[13px] font-semibold whitespace-nowrap text-gray-600 [&:has([role=checkbox])]:pr-0',
                className,
            )}
            {...props}
        />
    );
}

function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
    return <td className={cn('px-5 py-3 align-middle whitespace-nowrap', className)} {...props} />;
}

function TableCaption({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
    return <caption className={cn('mt-4 text-sm text-gray-500', className)} {...props} />;
}

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
