import React, { useState, useEffect } from "react";
import brain from "brain";
import { CreateUserRequest, CreateUserResponse, UserDetails, ListUsersResponse } from "types"; // Added UserDetails, ListUsersResponse
import { useCurrentUser, useUserGuardContext } from "app"; // Assuming useUserGuardContext is for protected pages
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

import { ADMIN_UIDS } from "utils/authConfig";

const AdminUsersPage = () => {
  const { user: firebaseUser, loading: firebaseUserLoading } = useCurrentUser(); // For checking admin status
  const [isAdmin, setIsAdmin] = useState(false);

  // State for creating users
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // State for listing users
  const [users, setUsers] = useState<UserDetails[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [listUsersError, setListUsersError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null | undefined>(undefined); // undefined initially, then string or null

  useEffect(() => {
    if (firebaseUser && ADMIN_UIDS.includes(firebaseUser.uid)) { // Changed from === ADMIN_UID to ADMIN_UIDS.includes()
      setIsAdmin(true);
    }
  }, [firebaseUser]);

  // Fetch initial users when admin status is confirmed
  useEffect(() => {
    if (isAdmin) {
      fetchUsers(undefined); // Fetch initial page
    }
  }, [isAdmin]);

  const fetchUsers = async (token: string | null | undefined) => {
    setIsLoadingUsers(true);
    setListUsersError(null);
    try {
      // Assuming brain.list_firebase_users is generated and takes page_token directly
      // The actual method name might be different, e.g., listFirebaseUsers or adminListUsers
      // And ensure the parameter is correctly named as per brain client definition
      const response = await brain.list_firebase_users({ pageToken: token }); 
      const data = response.data as ListUsersResponse;

      if (response.ok && data.users) {
        setUsers(prevUsers => token ? [...prevUsers, ...data.users] : data.users);
        setNextPageToken(data.next_page_token);
      } else {
        const errorData = response.error as any;
        const errorMessage = errorData?.detail || `Failed to fetch users (status: ${response.status})`;
        console.error("Error fetching users:", response);
        setListUsersError(errorMessage);
        toast.error("Error fetching users", { description: errorMessage });
      }
    } catch (err: any) {
      console.error("Network or other error fetching users:", err);
      const errorMessage = err.message || "An unexpected error occurred while fetching users.";
      setListUsersError(errorMessage);
      toast.error("Error fetching users", { description: errorMessage });
    }
    setIsLoadingUsers(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Validation Error", { description: "Email and password are required." });
      return;
    }
    if (password.length < 6) {
      toast.error("Validation Error", { description: "Password must be at least 6 characters long." });
      return;
    }

    setIsCreatingUser(true);
    try {
      const body: CreateUserRequest = { email, password };
      const response = await brain.create_firebase_user(body);

      if (response.ok) {
        const result = response.data as CreateUserResponse;
        toast.success("User Created", { description: `User ${result.email} (UID: ${result.uid}) created successfully.` });
        setEmail("");
        setPassword("");
        // Refresh user list after creating a new user
        if(isAdmin) fetchUsers(undefined);
      } else {
        const errorData = response.error as any;
        const errorMessage = errorData?.detail || `Failed to create user (status: ${response.status})`;
        console.error("Failed to create user:", response);
        toast.error("Error Creating User", { description: errorMessage });
      }
    } catch (err: any) {
      console.error("Network or other error creating user:", err);
      const errorMessage = err.message || "An unexpected error occurred.";
      toast.error("Error Creating User", { description: errorMessage });
    }
    setIsCreatingUser(false);
  };

  const formatTimestamp = (ms: number | null | undefined) => {
    if (!ms) return 'N/A';
    return new Date(ms).toLocaleString();
  };

  if (firebaseUserLoading) {
    return <div className="p-4">Loading user data...</div>;
  }
  
  if (!firebaseUser) {
    return <div className="p-4">You must be logged in to view this page.</div>; // Or redirect to login
  }

  if (!isAdmin) {
    return <div className="p-4">You are not authorized to view this page.</div>;
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Create New Firebase User</CardTitle>
          <CardDescription>Enter email and password to create a new user.</CardDescription>
        </CardHeader>
        <form onSubmit={handleCreateUser}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="user@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="********" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                minLength={6}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isCreatingUser}>
              {isCreatingUser ? "Creating..." : "Create User"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Firebase User List</CardTitle>
          <CardDescription>List of all users in Firebase Authentication.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUsers && <p>Loading users...</p>}
          {listUsersError && <p className="text-red-500">Error: {listUsersError}</p>}
          {!isLoadingUsers && !listUsersError && users.length === 0 && (
            <p>No users found.</p>
          )}
          {!isLoadingUsers && !listUsersError && users.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>UID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Last Sign-in</TableHead>
                  <TableHead>Disabled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.uid}>
                    <TableCell className="font-medium">{user.uid}</TableCell>
                    <TableCell>{user.email || 'N/A'}</TableCell>
                    <TableCell>{user.email_verified ? "Yes" : "No"}</TableCell>
                    <TableCell>{formatTimestamp(user.metadata.creation_timestamp_ms)}</TableCell>
                    <TableCell>{formatTimestamp(user.metadata.last_sign_in_timestamp_ms)}</TableCell>
                    <TableCell>{user.disabled ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {nextPageToken && !isLoadingUsers && (
            <div className="mt-4">
              <Button onClick={() => fetchUsers(nextPageToken)}>
                Load More Users
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsersPage;
