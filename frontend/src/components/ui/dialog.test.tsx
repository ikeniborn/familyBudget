import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { customRender } from '@/test/utils/test-utils';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './dialog';

describe('Dialog', () => {
  it('should not render content when closed', () => {
    customRender(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>Dialog description</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    expect(screen.getByText('Open Dialog')).toBeInTheDocument();
    expect(screen.queryByText('Dialog Title')).not.toBeInTheDocument();
  });

  it('should open dialog when trigger is clicked', async () => {
    const { user } = customRender(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>Dialog description</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    const trigger = screen.getByText('Open Dialog');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Dialog Title')).toBeInTheDocument();
      expect(screen.getByText('Dialog description')).toBeInTheDocument();
    });
  });

  it('should close dialog when close button is clicked', async () => {
    const { user } = customRender(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogClose>Close</DialogClose>
        </DialogContent>
      </Dialog>
    );

    expect(screen.getByText('Dialog Title')).toBeInTheDocument();

    const closeButton = screen.getByText('Close');
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Dialog Title')).not.toBeInTheDocument();
    });
  });

  it('should render with header and footer', async () => {
    const { user } = customRender(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Header Title</DialogTitle>
            <DialogDescription>Header description</DialogDescription>
          </DialogHeader>
          <div>Body content</div>
          <DialogFooter>
            <button>Cancel</button>
            <button>Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    await user.click(screen.getByText('Open'));

    await waitFor(() => {
      expect(screen.getByText('Header Title')).toBeInTheDocument();
      expect(screen.getByText('Header description')).toBeInTheDocument();
      expect(screen.getByText('Body content')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
    });
  });

  it('should handle controlled state', async () => {
    const onOpenChange = jest.fn();
    const { user, rerender } = customRender(
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Controlled Dialog</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    await user.click(screen.getByText('Open'));
    expect(onOpenChange).toHaveBeenCalledWith(true);

    // Dialog should not open because open={false}
    expect(screen.queryByText('Controlled Dialog')).not.toBeInTheDocument();

    // Update to open
    rerender(
      <Dialog open={true} onOpenChange={onOpenChange}>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Controlled Dialog</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    await waitFor(() => {
      expect(screen.getByText('Controlled Dialog')).toBeInTheDocument();
    });
  });

  it('should apply custom className to DialogContent', async () => {
    const { user } = customRender(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent className="custom-content">
          <DialogTitle>Custom Dialog</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    await user.click(screen.getByText('Open'));

    await waitFor(() => {
      const content = screen.getByRole('dialog');
      expect(content).toHaveClass('custom-content');
    });
  });

  it('should render DialogTitle with correct styling', async () => {
    const { user } = customRender(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Styled Title</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    await user.click(screen.getByText('Open'));

    await waitFor(() => {
      const title = screen.getByText('Styled Title');
      expect(title).toHaveClass('text-lg', 'font-semibold');
    });
  });

  it('should render DialogDescription with correct styling', async () => {
    const { user } = customRender(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogDescription>Styled Description</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    await user.click(screen.getByText('Open'));

    await waitFor(() => {
      const description = screen.getByText('Styled Description');
      expect(description).toHaveClass('text-sm', 'text-muted-foreground');
    });
  });

  it('should close on overlay click', async () => {
    const onOpenChange = jest.fn();
    const { user } = customRender(
      <Dialog defaultOpen onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Click Outside</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    // Find and click the overlay
    const overlay = document.querySelector('[data-radix-dialog-overlay]');
    expect(overlay).toBeInTheDocument();
    
    if (overlay) {
      await user.click(overlay);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    }
  });

  it('should handle complex dialog content', async () => {
    const { user } = customRender(
      <Dialog>
        <DialogTrigger asChild>
          <button>Open Complex Dialog</button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complex Dialog</DialogTitle>
            <DialogDescription>
              This dialog contains multiple elements
            </DialogDescription>
          </DialogHeader>
          <form>
            <input type="text" placeholder="Enter text" />
            <select>
              <option>Option 1</option>
              <option>Option 2</option>
            </select>
          </form>
          <DialogFooter>
            <DialogClose asChild>
              <button type="button">Cancel</button>
            </DialogClose>
            <button type="submit">Submit</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    await user.click(screen.getByText('Open Complex Dialog'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });
  });

  it('should support custom trigger element with asChild', async () => {
    const { user } = customRender(
      <Dialog>
        <DialogTrigger asChild>
          <button className="custom-trigger">Custom Trigger</button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog with Custom Trigger</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    const trigger = screen.getByText('Custom Trigger');
    expect(trigger).toHaveClass('custom-trigger');
    
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Dialog with Custom Trigger')).toBeInTheDocument();
    });
  });

  it('should handle modal property', async () => {
    const { user } = customRender(
      <Dialog modal={false}>
        <DialogTrigger>Open Non-Modal</DialogTrigger>
        <DialogContent>
          <DialogTitle>Non-Modal Dialog</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    await user.click(screen.getByText('Open Non-Modal'));

    await waitFor(() => {
      expect(screen.getByText('Non-Modal Dialog')).toBeInTheDocument();
    });
  });
});