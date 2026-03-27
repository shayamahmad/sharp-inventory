import React, { useState } from 'react';
import { User } from '@/lib/mockData';
import { useInventory } from '@/contexts/InventoryContext';
import { Button } from '@/components/ui/button';
import { Shield, UserCheck, Eye, Trash2 } from 'lucide-react';

const roleIcons: Record<string, React.ElementType> = { admin: Shield, staff: UserCheck, viewer: Eye };
const roleBadges: Record<string, string> = {
  admin: 'bg-primary/10 text-primary',
  staff: 'bg-accent/10 text-accent',
  viewer: 'bg-muted text-muted-foreground',
};
const rolePerms: Record<string, string[]> = {
  admin: ['View all', 'Add products', 'Edit products', 'Delete products', 'Manage users', 'Create orders'],
  staff: ['View all', 'Add products', 'Edit products', 'Create orders'],
  viewer: ['View products', 'View sales', 'View reports'],
};

export default function UsersPage() {
  const { users: usersList, setUsers: setUsersList } = useInventory();
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'staff' | 'viewer'>('staff');

  const removeUser = (id: string) => {
    if (id === '1') return;
    setUsersList(prev => prev.filter(u => u.id !== id));
  };

  const addUser = () => {
    if (!newName || !newEmail || !newPassword) return;
    const newUser: User = {
      id: String(Date.now()),
      name: newName,
      email: newEmail,
      password: newPassword,
      role: newRole,
    };
    setUsersList(prev => [...prev, newUser]);
    setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('staff');
    setShowAddStaff(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex justify-end">
        <Button onClick={() => setShowAddStaff(!showAddStaff)} className="gradient-primary text-primary-foreground gap-2">
          <UserCheck className="h-4 w-4" /> Add Staff / Viewer
        </Button>
      </div>

      {showAddStaff && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Add New User</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full Name" className="h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm" />
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" className="h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm" />
            <input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Password" type="password" className="h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm" />
            <select value={newRole} onChange={e => setNewRole(e.target.value as 'staff' | 'viewer')} className="h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm">
              <option value="staff">Staff</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button onClick={addUser} className="gradient-primary text-primary-foreground">Save</Button>
            <Button variant="outline" onClick={() => setShowAddStaff(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {usersList.map(user => {
          const Icon = roleIcons[user.role] || Eye;
          return (
            <div key={user.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-lg font-bold text-primary-foreground">
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${roleBadges[user.role]}`}>
                  <Icon className="h-3 w-3 inline mr-1" />{user.role}
                </span>
              </div>
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Permissions</p>
                <div className="flex flex-wrap gap-1.5">
                  {rolePerms[user.role].map(p => (
                    <span key={p} className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{p}</span>
                  ))}
                </div>
              </div>
              {user.role !== 'admin' && (
                <Button variant="destructive" size="sm" onClick={() => removeUser(user.id)} className="w-full gap-2">
                  <Trash2 className="h-3.5 w-3.5" /> Remove User
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
