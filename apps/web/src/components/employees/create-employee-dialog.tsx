'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { createEmployee } from '@/lib/api/employees';

interface CreateEmployeeDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateEmployeeDialog({ open, onClose, onCreated }: CreateEmployeeDialogProps) {
  const { toast } = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: () => createEmployee({
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      gender: gender || undefined,
      hireDate: hireDate || undefined,
      departmentId: departmentId || undefined,
      position: position || undefined,
      salary: salary ? parseFloat(salary) : undefined,
    }),
    onSuccess: () => {
      toast({ title: 'Employee created' });
      onCreated();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to create employee.',
        variant: 'destructive',
      });
    },
  });

  function handleClose() {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setGender('');
    setHireDate('');
    setDepartmentId('');
    setPosition('');
    setSalary('');
    setErrors({});
    onClose();
  }

  function handleSubmit() {
    const newErrors: Record<string, string> = {};
    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Invalid email';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    createMutation.mutate();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Create Employee</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                className={errors.firstName ? 'border-destructive' : ''}
              />
              {errors.firstName && <p className="text-xs text-destructive mt-1">{errors.firstName}</p>}
            </div>
            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className={errors.lastName ? 'border-destructive' : ''}
              />
              {errors.lastName && <p className="text-xs text-destructive mt-1">{errors.lastName}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@company.com"
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div>
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="hireDate">Hire Date</Label>
              <Input
                id="hireDate"
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Software Engineer"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="salary">Base Salary</Label>
            <Input
              id="salary"
              type="number"
              min="0"
              step="0.01"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Employee'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
