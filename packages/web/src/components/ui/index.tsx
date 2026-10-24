import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Checkbox } from './checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
import { RadioGroup, RadioGroupItem } from './radio-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue } from './select';

// Test component to verify all imports work
export function TestComponents() {
  return (
    <div>
      <Button>Test Button</Button>
      <Input placeholder="Test Input" />
      <Label>Test Label</Label>
      <Checkbox />
      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
          <CardDescription>Test Description</CardDescription>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Dialog</DialogTitle>
            <DialogDescription>Test Description</DialogDescription>
          </DialogHeader>
          <DialogFooter>Footer</DialogFooter>
        </DialogContent>
      </Dialog>
      <RadioGroup>
        <RadioGroupItem value="test" />
      </RadioGroup>
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Test" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Test</SelectLabel>
            <SelectItem value="test">Test</SelectItem>
            <SelectSeparator />
          </SelectGroup>
          <SelectScrollUpButton />
          <SelectScrollDownButton />
        </SelectContent>
      </Select>
    </div>
  );
}

export { Button, Input, Label, Checkbox, Card, Dialog, RadioGroup, Select };
