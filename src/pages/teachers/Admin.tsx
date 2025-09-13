import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ToastHost } from '@/components/common/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';

export default function TeacherAdmin() {
  return (
    <div className="container mx-auto p-6 space-y-6 relative">
      <ToastHost />
      <Card>
        <CardHeader>
          <CardTitle>Create Teacher Group</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3">
            <Input placeholder="Group name" />
            <Input type="date" />
            <Button type="button">Create</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import Students (CSV)</CardTitle>
        </CardHeader>
        <CardContent>
          <Input type="file" accept=".csv" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="border">
            <THead className="bg-gray-50">
              <TR>
                <TH className="px-2">ID</TH>
                <TH>Name</TH>
                <TH>Username</TH>
                <TH>Age</TH>
                <TH>Email</TH>
                <TH>Group</TH>
              </TR>
            </THead>
            <TBody>
              <TR>
                <TD colSpan={6} className="text-center text-sm p-2">
                  No students yet.
                </TD>
              </TR>
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
