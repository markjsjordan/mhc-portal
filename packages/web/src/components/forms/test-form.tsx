import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Form validation schema
const testFormSchema = z.object({
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters.')
    .max(100, 'Title must be at most 100 characters.'),
  description: z
    .string()
    .min(20, 'Description must be at least 20 characters.')
    .max(500, 'Description must be at most 500 characters.'),
  category: z.string().min(1, 'Please select a category.'),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms.',
  }),
});

type TestFormData = z.infer<typeof testFormSchema>;

/**
 * Test form component that demonstrates all advanced shadcn/ui components.
 * This verifies:
 * - Form component (Field-based)
 * - React Hook Form integration
 * - Tabs
 * - Tooltip
 * - Dropdown Menu
 * - Popover
 * - Table
 */
export function TestForm() {
  const form = useForm<TestFormData>({
    resolver: zodResolver(testFormSchema),
    defaultValues: {
      title: '',
      description: '',
      category: '',
      agreeToTerms: false,
    },
  });

  function onSubmit(data: TestFormData) {
    console.log('Form submitted:', data);
    alert(JSON.stringify(data, null, 2));
  }

  return (
    <TooltipProvider>
      <div className="w-full max-w-4xl mx-auto p-6 space-y-8">
        <h1 className="text-2xl font-bold">Advanced Components Test</h1>

        {/* Tabs Component Test */}
        <Tabs defaultValue="form" className="w-full">
          <TabsList>
            <TabsTrigger value="form">Form Demo</TabsTrigger>
            <TabsTrigger value="table">Table Demo</TabsTrigger>
            <TabsTrigger value="ui">UI Components</TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="space-y-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Field with Input */}
              <Controller
                name="title"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Title</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      placeholder="Enter a title"
                    />
                    <FieldDescription>
                      Provide a concise title for your submission.
                    </FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              {/* Field with Textarea */}
              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                    <Textarea
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      placeholder="Enter a detailed description"
                      className="min-h-[120px]"
                    />
                    <FieldDescription>
                      Provide a detailed description of your submission.
                    </FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              {/* Field with Select */}
              <Controller
                name="category"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Category</FieldLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bug">Bug Report</SelectItem>
                        <SelectItem value="feature">Feature Request</SelectItem>
                        <SelectItem value="question">Question</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Choose the category that best fits your submission.
                    </FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              {/* Field with Checkbox */}
              <Controller
                name="agreeToTerms"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={field.name}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldLabel htmlFor={field.name} className="!mt-0">
                        I agree to the terms and conditions
                      </FieldLabel>
                    </div>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              <Button type="submit">Submit Form</Button>
            </form>
          </TabsContent>

          <TabsContent value="table" className="space-y-4">
            <h2 className="text-xl font-semibold">Table Component Demo</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">John Doe</TableCell>
                  <TableCell>Active</TableCell>
                  <TableCell>Admin</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Delete</DropdownMenuItem>
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Jane Smith</TableCell>
                  <TableCell>Active</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Delete</DropdownMenuItem>
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="ui" className="space-y-6">
            <h2 className="text-xl font-semibold">UI Components Demo</h2>

            {/* Tooltip Demo */}
            <div className="space-y-2">
              <h3 className="font-medium">Tooltip</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">Hover me</Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This is a tooltip</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Popover Demo */}
            <div className="space-y-2">
              <h3 className="font-medium">Popover</h3>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">Open Popover</Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="font-medium">Popover Content</h4>
                    <p className="text-sm text-muted-foreground">
                      This is a popover with custom content.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Dropdown Menu Demo */}
            <div className="space-y-2">
              <h3 className="font-medium">Dropdown Menu</h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Open Menu</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuItem>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
